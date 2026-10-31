package demo

import (
	"context"
	"encoding/binary"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/internal/app/auth"
)

const (
	AdminEmail         = "demo-admin@league-s.test"
	AdminPassword      = "demo-admin-password"
	SuperadminEmail    = "demo-superadmin@league-s.test"
	SuperadminPassword = "demo-superadmin-password"
	LeagueName         = "District Five Demo"
	CheckLeagueName    = "Ligue de vérification"
	playersPerTeam     = 8
	liveFor            = 25 * time.Minute
)

const (
	kindSeason byte = iota + 1
	kindTeam
	kindPlayer
	kindMembership
	kindMatch
	kindUser
)

var (
	LeagueID         = uuid.MustParse("01a10d58-8ae3-7c66-ac38-c7cac896cc65")
	AdminID          = id(kindUser, 1)
	SuperadminID     = id(kindUser, 2)
	PreviousSeasonID = id(kindSeason, 1)
	CurrentSeasonID  = id(kindSeason, 2)
)

var teamNames = []string{
	"AS Belleville", "FC Canal", "Olympique Ménilmontant", "Racing Oberkampf", "US Bastille",
	"Étoile de Charonne", "Sporting Jaurès", "Red Star Voltaire", "Union Père-Lachaise", "Athletic Goncourt",
}

var firstnames = []string{
	"Adam", "Bilal", "Clément", "David", "Elias", "Florian", "Gabriel", "Hugo", "Ibrahim", "Jules",
	"Karim", "Lucas", "Mehdi", "Nathan", "Omar", "Paul", "Quentin", "Rayan", "Sofiane", "Théo",
}

var lastnames = []string{
	"Martin", "Benali", "Dubois", "Traoré", "Lefèvre", "Diallo", "Moreau", "Haddad", "Garnier", "Koné",
	"Rousseau", "Belkacem", "Fontaine", "Camara", "Girard", "Mansouri", "Lambert", "Sow", "Mercier", "Cissé",
}

type season struct {
	id            uuid.UUID
	name          string
	startOn       time.Time
	endOn         time.Time
	firstMatchday time.Time
}

var seasons = []season{
	{PreviousSeasonID, "2025-2026", date(2025, time.August, 30), date(2026, time.May, 31), date(2025, time.September, 6)},
	{CurrentSeasonID, "2026-2027", date(2026, time.August, 29), date(2027, time.May, 30), date(2026, time.September, 5)},
}

type Team struct {
	ID   uuid.UUID
	Name string
}

func Teams() []Team {
	res := make([]Team, len(teamNames))
	var n uint32
	for i, name := range teamNames {
		n++
		res[i] = Team{ID: id(kindTeam, n), Name: name}
	}
	return res
}

func Seed(ctx context.Context, pool *pgxpool.Pool, now time.Time) error {
	paris, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		return fmt.Errorf("load time zone: %w", err)
	}

	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		w := &writer{tx: tx, paris: paris, now: now, teams: Teams()}
		if err := w.deleteLeagues(ctx); err != nil {
			return err
		}
		return w.seed(ctx)
	})
}

type writer struct {
	tx      pgx.Tx
	paris   *time.Location
	now     time.Time
	teams   []Team
	played  int32
	members uint32
	matches uint32
}

func (w *writer) exec(ctx context.Context, what, sql string, args ...any) error {
	if _, err := w.tx.Exec(ctx, sql, args...); err != nil {
		return fmt.Errorf("%s: %w", what, err)
	}
	return nil
}

func (w *writer) deleteLeagues(ctx context.Context) error {
	rows, err := w.tx.Query(ctx, `SELECT id FROM league WHERE id = $1 OR name = $2`, LeagueID, CheckLeagueName)
	if err != nil {
		return fmt.Errorf("find leagues to reset: %w", err)
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[uuid.UUID])
	if err != nil {
		return fmt.Errorf("find leagues to reset: %w", err)
	}

	statements := []string{
		`DELETE FROM match USING season WHERE match.season_id = season.id AND season.league_id = $1`,
		`DELETE FROM squad_membership WHERE league_id = $1`,
		`DELETE FROM season_team WHERE league_id = $1`,
		`DELETE FROM season WHERE league_id = $1`,
		`DELETE FROM player WHERE league_id = $1`,
		`DELETE FROM team WHERE league_id = $1`,
		`DELETE FROM league WHERE id = $1`,
	}
	for _, leagueID := range ids {
		for _, stmt := range statements {
			if err := w.exec(ctx, "reset league "+leagueID.String(), stmt, leagueID); err != nil {
				return err
			}
		}
	}
	return w.exec(ctx, "delete demo users", `DELETE FROM app_user WHERE id = ANY($1) OR email = ANY($2)`,
		[]uuid.UUID{AdminID, SuperadminID}, []string{AdminEmail, SuperadminEmail})
}

func (w *writer) seed(ctx context.Context) error {
	if err := w.exec(ctx, "create league", `INSERT INTO league (id, name) VALUES ($1, $2)`, LeagueID, LeagueName); err != nil {
		return err
	}
	if err := w.users(ctx); err != nil {
		return err
	}

	var player uint32
	for i, t := range w.teams {
		if err := w.exec(ctx, "create team "+t.Name,
			`INSERT INTO team (id, league_id, name) VALUES ($1, $2, $3)`, t.ID, LeagueID, t.Name); err != nil {
			return err
		}
		for j := range playersPerTeam {
			n := i*playersPerTeam + j
			player++
			if err := w.exec(ctx, "create player of "+t.Name,
				`INSERT INTO player (id, league_id, firstname, lastname) VALUES ($1, $2, $3, $4)`,
				id(kindPlayer, player), LeagueID, firstnames[n%len(firstnames)], lastnames[(n*7+i)%len(lastnames)]); err != nil {
				return err
			}
		}
	}

	for _, s := range seasons {
		if err := w.season(ctx, s); err != nil {
			return err
		}
		if err := w.calendar(ctx, s); err != nil {
			return err
		}
	}
	return nil
}

func (w *writer) users(ctx context.Context) error {
	if err := w.user(ctx, AdminID, AdminEmail, "Demo Admin", AdminPassword, false); err != nil {
		return err
	}
	if err := w.user(ctx, SuperadminID, SuperadminEmail, "Demo Superadmin", SuperadminPassword, true); err != nil {
		return err
	}
	return w.exec(ctx, "make demo admin an admin of the demo league",
		`INSERT INTO league_admin (user_id, league_id) VALUES ($1, $2)`, AdminID, LeagueID)
}

func (w *writer) user(ctx context.Context, id uuid.UUID, email, name, password string, superadmin bool) error {
	hash, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("hash password of %s: %w", email, err)
	}
	return w.exec(ctx, "create "+email,
		`INSERT INTO app_user (id, email, name, password_hash, is_superadmin) VALUES ($1, $2, $3, $4, $5)`,
		id, email, name, hash, superadmin)
}

func (w *writer) season(ctx context.Context, s season) error {
	err := w.exec(ctx, "create season "+s.name,
		`INSERT INTO season (id, league_id, name, start_on, end_on, match_win_pts, match_draw_pts, match_loss_pts, tie_breakers)
		 VALUES ($1, $2, $3, $4, $5, 3, 1, 0, '{goal_difference,goals_scored,head_to_head}')`,
		s.id, LeagueID, s.name, s.startOn, s.endOn)
	if err != nil {
		return err
	}

	var player uint32
	for _, t := range w.teams {
		if err := w.exec(ctx, "register "+t.Name+" in "+s.name,
			`INSERT INTO season_team (season_id, team_id, league_id) VALUES ($1, $2, $3)`, s.id, t.ID, LeagueID); err != nil {
			return err
		}
		for j := range playersPerTeam {
			player++
			w.members++
			if err := w.exec(ctx, "add a player to "+t.Name+" in "+s.name,
				`INSERT INTO squad_membership (id, player_id, season_id, team_id, league_id, number, joined_on)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				id(kindMembership, w.members), id(kindPlayer, player), s.id, t.ID, LeagueID, j+1, s.startOn); err != nil {
				return err
			}
		}
	}
	return nil
}

func (w *writer) calendar(ctx context.Context, s season) error {
	rounds := roundRobin(len(w.teams))
	live := false

	for i, round := range append(rounds, reversed(rounds)...) {
		matchday := i + 1
		day := s.firstMatchday.AddDate(0, 0, 7*i)

		for slot, pairing := range round {
			kickoff := time.Date(day.Year(), day.Month(), day.Day(), 14+slot, 0, 0, 0, w.paris).UTC()
			status := "scheduled"
			var home, away *int32

			switch {
			case kickoff.After(w.now) && !live:
				live = true
				status, kickoff = "live", w.now.Add(-liveFor)
				home, away = new(int32(1)), new(int32(0))
			case kickoff.After(w.now):
			case matchday%6 == 0 && slot == len(round)-1:
				status = "postponed"
			default:
				status = "finished"
				home, away = w.score()
			}

			w.matches++
			if err := w.exec(ctx, fmt.Sprintf("create match %d of matchday %d in %s", slot+1, matchday, s.name),
				`INSERT INTO match (id, season_id, home_team_id, away_team_id, matchday, kickoff_at, status, home_score, away_score)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				id(kindMatch, w.matches), s.id, w.teams[pairing[0]].ID, w.teams[pairing[1]].ID, matchday, kickoff, status, home, away); err != nil {
				return err
			}
		}
	}
	return nil
}

func (w *writer) score() (*int32, *int32) {
	w.played++
	home := (w.played*7 + w.played/3) % 6
	away := (w.played*5 + w.played/4) % 5
	return &home, &away
}

func roundRobin(n int) [][][2]int {
	order := make([]int, n)
	for i := range order {
		order[i] = i
	}

	rounds := make([][][2]int, n-1)
	for r := range rounds {
		rounds[r] = make([][2]int, n/2)
		for i := range n / 2 {
			home, away := order[i], order[n-1-i]
			if r%2 == 1 {
				home, away = away, home
			}
			rounds[r][i] = [2]int{home, away}
		}
		order = append([]int{order[0], order[n-1]}, order[1:n-1]...)
	}
	return rounds
}

func reversed(rounds [][][2]int) [][][2]int {
	res := make([][][2]int, len(rounds))
	for r, round := range rounds {
		res[r] = make([][2]int, len(round))
		for i, pairing := range round {
			res[r][i] = [2]int{pairing[1], pairing[0]}
		}
	}
	return res
}

func id(kind byte, n uint32) uuid.UUID {
	res := LeagueID
	res[8], res[9], res[10], res[11] = 0x80, kind, 0, 0
	binary.BigEndian.PutUint32(res[12:], n)
	return res
}

func date(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}
