package testdb

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/internal/db"
)

type Seeder struct {
	t             *testing.T
	pool          *pgxpool.Pool
	q             *db.Queries
	defaultLeague *db.League
	counter       int
}

func New(t *testing.T, pool *pgxpool.Pool) *Seeder {
	t.Helper()
	Reset(t, pool)
	return &Seeder{t: t, pool: pool, q: db.New(pool)}
}

type LeagueParams struct {
	Name string
	Logo string
}

type TeamParams struct {
	League *db.League
	Name   string
	Logo   string
}

type PlayerParams struct {
	League    *db.League
	Firstname string
	Lastname  string
	Icon      string
}

type SeasonParams struct {
	League       *db.League
	Name         string
	StartOn      string
	EndOn        string
	MaxSquadSize int32
}

type SquadMemberParams struct {
	Season   db.Season
	Team     db.Team
	Player   db.Player
	Number   int32
	JoinedOn string
	LeftOn   string
}

type MatchParams struct {
	Season    db.Season
	Home      db.Team
	Away      db.Team
	Matchday  int
	KickoffAt *time.Time
	Status    db.MatchStatus
	Score     *Score
}

type Score struct {
	Home int32
	Away int32
}

type SquadMemberParams struct {
	Season   db.Season
	Team     db.Team
	Player   db.Player
	Number   int32
	JoinedOn string
}

func (s *Seeder) CreateLeague(p LeagueParams) db.League {
	s.t.Helper()
	if p.Name == "" {
		p.Name = fmt.Sprintf("League %d", s.next())
	}

	l, err := s.q.CreateLeague(context.Background(), db.CreateLeagueParams{Name: p.Name, Logo: optional(p.Logo)})
	if err != nil {
		s.t.Fatalf("create league %q: %v", p.Name, err)
	}
	return l
}

func (s *Seeder) CreateTeam(p TeamParams) db.Team {
	s.t.Helper()
	league := s.leagueOrDefault(p.League)
	if p.Name == "" {
		p.Name = fmt.Sprintf("Team %d", s.next())
	}

	team, err := s.q.CreateTeam(context.Background(), db.CreateTeamParams{
		LeagueID: league.ID,
		Name:     p.Name,
		Logo:     optional(p.Logo),
	})
	if err != nil {
		s.t.Fatalf("create team %q: %v", p.Name, err)
	}
	return team
}

func (s *Seeder) CreatePlayer(p PlayerParams) db.Player {
	s.t.Helper()
	league := s.leagueOrDefault(p.League)
	if p.Firstname == "" && p.Lastname == "" {
		n := s.next()
		p.Firstname, p.Lastname = fmt.Sprintf("Firstname %d", n), fmt.Sprintf("Lastname %d", n)
	}

	player, err := s.q.CreatePlayer(context.Background(), db.CreatePlayerParams{
		LeagueID:  league.ID,
		Firstname: p.Firstname,
		Lastname:  p.Lastname,
		Icon:      optional(p.Icon),
	})
	if err != nil {
		s.t.Fatalf("create player %s %s: %v", p.Firstname, p.Lastname, err)
	}
	return player
}

func (s *Seeder) CreateSeason(p SeasonParams) db.Season {
	s.t.Helper()
	league := s.leagueOrDefault(p.League)
	if p.Name == "" {
		p.Name = fmt.Sprintf("Season %d", s.next())
	}
	if p.StartOn == "" {
		p.StartOn = "2025-08-01"
	}
	if p.EndOn == "" {
		p.EndOn = "2026-05-31"
	}

	season, err := s.q.CreateSeason(context.Background(), db.CreateSeasonParams{
		Name:         p.Name,
		StartOn:      s.date(p.StartOn),
		EndOn:        s.date(p.EndOn),
		MatchWinPts:  3,
		MatchDrawPts: 1,
		MatchLossPts: 0,
		TieBreakers:  []string{"goal_difference"},
		MaxSquadSize: positive(p.MaxSquadSize),
		LeagueID:     league.ID,
	})
	if err != nil {
		s.t.Fatalf("create season %q: %v", p.Name, err)
	}
	return season
}

func (s *Seeder) RegisterTeams(season db.Season, teams ...db.Team) {
	s.t.Helper()
	for _, team := range teams {
		_, err := s.q.AddTeamToSeason(context.Background(), db.AddTeamToSeasonParams{
			SeasonID: season.ID,
			TeamID:   team.ID,
			LeagueID: season.LeagueID,
		})
		if err != nil {
			s.t.Fatalf("register team %q in season %q: %v", team.Name, season.Name, err)
		}
	}
}

func (s *Seeder) SquadMember(p SquadMemberParams) db.SquadMembership {
	s.t.Helper()
	if p.JoinedOn == "" {
		p.JoinedOn = p.Season.StartOn.Format(time.DateOnly)
	}
	var number *int32
	if p.Number != 0 {
		number = &p.Number
	}

	m, err := s.q.CreateSquadMembership(context.Background(), db.CreateSquadMembershipParams{
		PlayerID: p.Player.ID,
		SeasonID: p.Season.ID,
		TeamID:   p.Team.ID,
		LeagueID: p.Season.LeagueID,
		Number:   number,
		JoinedOn: s.date(p.JoinedOn),
	})
	if err != nil {
		s.t.Fatalf("add player %s to team %q in season %q: %v", p.Player.Lastname, p.Team.Name, p.Season.Name, err)
	}
	if p.LeftOn == "" {
		return m
	}

	m, err = s.q.CloseSquadMembership(context.Background(), db.CloseSquadMembershipParams{
		LeftOn:   s.date(p.LeftOn),
		PlayerID: p.Player.ID,
		SeasonID: p.Season.ID,
		TeamID:   p.Team.ID,
		LeagueID: p.Season.LeagueID,
	})
	if err != nil {
		s.t.Fatalf("close membership of player %s in team %q: %v", p.Player.Lastname, p.Team.Name, err)
	}
	return m
}

func (s *Seeder) CreateMatch(p MatchParams) uuid.UUID {
	s.t.Helper()
	if p.Matchday == 0 {
		p.Matchday = 1
	}
	if p.Status == "" {
		p.Status = db.MatchStatusScheduled
	}
	var homeScore, awayScore *int32
	if p.Score != nil {
		homeScore, awayScore = &p.Score.Home, &p.Score.Away
	}

	var id uuid.UUID
	err := s.pool.QueryRow(context.Background(),
		`INSERT INTO match (season_id, home_team_id, away_team_id, matchday, kickoff_at, status, home_score, away_score)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		p.Season.ID, p.Home.ID, p.Away.ID, p.Matchday, p.KickoffAt, p.Status, homeScore, awayScore,
	).Scan(&id)
	if err != nil {
		s.t.Fatalf("create match %q vs %q: %v", p.Home.Name, p.Away.Name, err)
	}
	return id
}

func (s *Seeder) CreateSquadMember(p SquadMemberParams) db.SquadMembership {
	s.t.Helper()
	joinedOn := p.Season.StartOn
	if p.JoinedOn != "" {
		joinedOn = s.date(p.JoinedOn)
	}
	m, err := s.q.CreateSquadMembership(context.Background(), db.CreateSquadMembershipParams{
		PlayerID: p.Player.ID,
		SeasonID: p.Season.ID,
		TeamID:   p.Team.ID,
		LeagueID: p.Season.LeagueID,
		Number:   positive(p.Number),
		JoinedOn: joinedOn,
	})
	if err != nil {
		s.t.Fatalf("add %s %s to the squad of %q: %v", p.Player.Firstname, p.Player.Lastname, p.Team.Name, err)
	}
	return m
}

func (s *Seeder) leagueOrDefault(l *db.League) db.League {
	if l != nil {
		return *l
	}
	if s.defaultLeague == nil {
		league := s.CreateLeague(LeagueParams{})
		s.defaultLeague = &league
	}
	return *s.defaultLeague
}

func (s *Seeder) next() int {
	s.counter++
	return s.counter
}

func (s *Seeder) date(v string) time.Time {
	s.t.Helper()
	d, err := time.Parse(time.DateOnly, v)
	if err != nil {
		s.t.Fatalf("invalid date %q, want YYYY-MM-DD: %v", v, err)
	}
	return d
}

func optional(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func positive(v int32) *int32 {
	if v == 0 {
		return nil
	}
	return &v
}
