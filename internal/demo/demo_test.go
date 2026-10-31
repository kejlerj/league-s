//go:build integration

package demo

import (
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"league-s/internal/app/auth"
	"league-s/internal/app/match"
	"league-s/internal/mailer"
	"league-s/internal/testdb"
)

var seedNow = time.Date(2026, time.October, 31, 15, 0, 0, 0, time.UTC)

func count(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(t.Context(), query, args...).Scan(&n); err != nil {
		t.Fatalf("count %q: %v", query, err)
	}
	return n
}

func ids(t *testing.T, query string, args ...any) []uuid.UUID {
	t.Helper()
	rows, err := testPool.Query(t.Context(), query, args...)
	if err != nil {
		t.Fatalf("query %q: %v", query, err)
	}
	defer rows.Close()

	var res []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			t.Fatalf("scan id: %v", err)
		}
		res = append(res, id)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("read ids: %v", err)
	}
	return res
}

func seed(t *testing.T, now time.Time) {
	t.Helper()
	if err := Seed(t.Context(), testPool, now); err != nil {
		t.Fatalf("Seed() error = %v", err)
	}
}

func listMatches(t *testing.T, seasonID uuid.UUID) []*match.Match {
	t.Helper()
	matches, err := match.NewPostgresStore(testPool).List(t.Context(), LeagueID, seasonID, match.Filter{})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	return matches
}

func byStatus(matches []*match.Match) map[match.Status]int {
	res := map[match.Status]int{}
	for _, m := range matches {
		res[m.Status()]++
	}
	return res
}

func TestSeed_BuildsOneLeagueWithTenTeamsSquadsAndTwoSeasons(t *testing.T) {
	testdb.New(t, testPool)
	seed(t, seedNow)

	checks := []struct {
		name  string
		query string
		want  int
	}{
		{"leagues", `SELECT count(*) FROM league WHERE id = $1`, 1},
		{"teams", `SELECT count(*) FROM team WHERE league_id = $1`, 10},
		{"players", `SELECT count(*) FROM player WHERE league_id = $1`, 80},
		{"seasons", `SELECT count(*) FROM season WHERE league_id = $1`, 2},
		{"registered teams", `SELECT count(*) FROM season_team WHERE league_id = $1`, 20},
		{"active squad members", `SELECT count(*) FROM squad_membership WHERE league_id = $1 AND left_on IS NULL`, 160},
	}
	for _, c := range checks {
		t.Run(c.name, func(t *testing.T) {
			if got := count(t, c.query, LeagueID); got != c.want {
				t.Errorf("%s = %d, want %d", c.name, got, c.want)
			}
		})
	}

	for _, seasonID := range []uuid.UUID{PreviousSeasonID, CurrentSeasonID} {
		if got := len(listMatches(t, seasonID)); got != 90 {
			t.Errorf("matches of season %s = %d, want 90 (home and away round robin of 10 teams)", seasonID, got)
		}
	}
}

func TestSeed_PreviousSeasonIsFinishedExceptPostponedMatches(t *testing.T) {
	testdb.New(t, testPool)
	seed(t, seedNow)

	got := byStatus(listMatches(t, PreviousSeasonID))
	want := map[match.Status]int{match.StatusFinished: 87, match.StatusPostponed: 3}
	for status, n := range want {
		if got[status] != n {
			t.Errorf("%s matches = %d, want %d (all: %v)", status, got[status], n, got)
		}
	}
}

func TestSeed_CurrentSeasonHasOneLiveMatchBetweenPlayedAndUpcomingOnes(t *testing.T) {
	testdb.New(t, testPool)
	seed(t, seedNow)

	matches := listMatches(t, CurrentSeasonID)
	if got := byStatus(matches); got[match.StatusLive] != 1 || got[match.StatusFinished] == 0 || got[match.StatusScheduled] == 0 {
		t.Fatalf("statuses = %v, want 1 live, some finished, some scheduled", got)
	}

	for _, m := range matches {
		kickoff := *m.KickoffAt()
		switch m.Status() {
		case match.StatusFinished:
			if kickoff.After(seedNow) || m.Score() == nil {
				t.Errorf("finished match %s kicks off at %s with score %v, want a past kickoff and a score", m.ID(), kickoff, m.Score())
			}
		case match.StatusScheduled:
			if !kickoff.After(seedNow) || m.Score() != nil {
				t.Errorf("scheduled match %s kicks off at %s with score %v, want a future kickoff and no score", m.ID(), kickoff, m.Score())
			}
		case match.StatusLive:
			if !kickoff.Equal(seedNow.Add(-25*time.Minute)) || m.Score() == nil {
				t.Errorf("live match %s kicks off at %s with score %v, want 25 minutes ago with a score", m.ID(), kickoff, m.Score())
			}
		case match.StatusPostponed:
			if kickoff.After(seedNow) || m.Score() != nil {
				t.Errorf("postponed match %s kicks off at %s with score %v, want a past kickoff and no score", m.ID(), kickoff, m.Score())
			}
		case match.StatusCancelled:
			t.Errorf("match %s is cancelled, want no cancelled match", m.ID())
		}
	}
}

func TestSeed_KeepsTheSameIDsWhenRunAgain(t *testing.T) {
	testdb.New(t, testPool)

	queries := []string{
		`SELECT id FROM team WHERE league_id = $1 ORDER BY id`,
		`SELECT id FROM player WHERE league_id = $1 ORDER BY id`,
		`SELECT id FROM season WHERE league_id = $1 ORDER BY id`,
		`SELECT id FROM squad_membership WHERE league_id = $1 ORDER BY id`,
		`SELECT m.id FROM match m JOIN season s ON s.id = m.season_id WHERE s.league_id = $1 ORDER BY m.id`,
	}

	seed(t, seedNow)
	first := make([][]uuid.UUID, len(queries))
	for i, q := range queries {
		first[i] = ids(t, q, LeagueID)
	}

	seed(t, seedNow.AddDate(0, 0, 14))
	for i, q := range queries {
		if got := ids(t, q, LeagueID); !slices.Equal(got, first[i]) {
			t.Errorf("%q returned other IDs on the second run", q)
		}
	}

	if got := ids(t, `SELECT id FROM season WHERE league_id = $1 ORDER BY id`, LeagueID); !slices.Equal(got, []uuid.UUID{PreviousSeasonID, CurrentSeasonID}) {
		t.Errorf("season IDs = %v, want [%s %s]", got, PreviousSeasonID, CurrentSeasonID)
	}
}

func TestSeed_LeavesOtherLeaguesUntouched(t *testing.T) {
	s := testdb.New(t, testPool)
	other := s.CreateLeague(testdb.LeagueParams{Name: "Other league"})
	s.CreateTeam(testdb.TeamParams{League: &other})

	seed(t, seedNow)
	seed(t, seedNow)

	if got := count(t, `SELECT count(*) FROM team WHERE league_id = $1`, other.ID); got != 1 {
		t.Errorf("teams of the other league = %d, want 1", got)
	}
}

func TestSeed_DemoAdminLogsInAndAdministersTheDemoLeague(t *testing.T) {
	testdb.New(t, testPool)
	seed(t, seedNow)
	seed(t, seedNow)

	store := auth.NewPostgresStore(testPool)
	_, user, err := auth.NewService(store, auth.EmailNotifier{Mailer: mailer.Disabled{}}).Login(t.Context(), AdminEmail, AdminPassword)
	if err != nil {
		t.Fatalf("Login(%s) error = %v", AdminEmail, err)
	}
	if user.IsSuperadmin {
		t.Error("demo admin is a superadmin, want a league admin only")
	}
	admin, err := store.IsLeagueAdmin(t.Context(), user.ID, LeagueID)
	if err != nil || !admin {
		t.Errorf("IsLeagueAdmin() = %t, %v, want true", admin, err)
	}
}
