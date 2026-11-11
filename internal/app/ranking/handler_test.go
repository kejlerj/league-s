//go:build integration

package ranking

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/app/match"
	"league-s/internal/app/season"
	"league-s/internal/db"
	"league-s/internal/testdb"
	"league-s/internal/testhttp"
)

func newTestRouter() http.Handler {
	h := NewHandler(season.NewPostgresStore(testPool), match.NewPostgresStore(testPool))

	r := chi.NewRouter()
	r.Get("/api/v1/leagues/{leagueID}/seasons/{seasonID}/scorers", h.Scorers)
	r.Get("/api/v1/leagues/{leagueID}/seasons/{seasonID}/assists", h.Assists)
	return r
}

func get(t *testing.T, path string) []rowResponse {
	t.Helper()
	rec := testhttp.Do(t, newTestRouter(), http.MethodGet, path, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s: status = %d, body = %s", path, rec.Code, rec.Body)
	}
	var rows []rowResponse
	if err := json.NewDecoder(rec.Body).Decode(&rows); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return rows
}

type wantRow struct {
	rank   int
	player db.Player
	team   db.Team
	value  int32
}

func checkResponse(t *testing.T, got []rowResponse, wants []wantRow) {
	t.Helper()
	if len(got) != len(wants) {
		t.Fatalf("got %d rows (%+v), want %d", len(got), got, len(wants))
	}
	for i, w := range wants {
		g := got[i]
		if g.Rank != w.rank || g.PlayerID != w.player.ID || g.Firstname != w.player.Firstname || g.Lastname != w.player.Lastname || g.TeamID != w.team.ID || g.TeamName != w.team.Name || g.Value != w.value {
			t.Errorf("row %d = %+v, want rank %d %s of %s with %d", i, g, w.rank, w.player.Lastname, w.team.Name, w.value)
		}
	}
}

func TestScorersAndAssists(t *testing.T) {
	s := testdb.New(t, testPool)
	ssn := s.CreateSeason(testdb.SeasonParams{})
	lions, bears := s.CreateTeam(testdb.TeamParams{Name: "Lions"}), s.CreateTeam(testdb.TeamParams{Name: "Bears"})
	s.RegisterTeams(ssn, lions, bears)
	diarra := s.CreatePlayer(testdb.PlayerParams{Firstname: "Malik", Lastname: "Diarra"})
	dupont := s.CreatePlayer(testdb.PlayerParams{Firstname: "Léo", Lastname: "Dupont"})
	martin := s.CreatePlayer(testdb.PlayerParams{Firstname: "Anne", Lastname: "Martin"})

	finished := func(matchday int) uuid.UUID {
		return s.CreateMatch(testdb.MatchParams{Season: ssn, Home: lions, Away: bears, Matchday: matchday, Status: db.MatchStatusFinished, Score: &testdb.Score{Home: 9, Away: 9}})
	}
	first, second := finished(1), finished(2)
	live := s.CreateMatch(testdb.MatchParams{Season: ssn, Home: lions, Away: bears, Matchday: 3, Status: db.MatchStatusLive, Score: &testdb.Score{Home: 1}})
	cancelled := s.CreateMatch(testdb.MatchParams{Season: ssn, Home: lions, Away: bears, Matchday: 4, Status: db.MatchStatusCancelled, Score: &testdb.Score{Home: 1}})
	postponed := s.CreateMatch(testdb.MatchParams{Season: ssn, Home: lions, Away: bears, Matchday: 5, Status: db.MatchStatusPostponed, Score: &testdb.Score{Home: 1}})

	goal := func(matchID uuid.UUID, team db.Team, scorer, assist *db.Player) {
		s.CreateMatchEvent(testdb.MatchEventParams{Season: ssn, MatchID: matchID, Team: team, Type: db.MatchEventTypeGoal, Player: scorer, Assist: assist})
	}
	goal(first, lions, &diarra, &dupont)
	goal(first, bears, &martin, nil)
	goal(first, lions, nil, &dupont)
	s.CreateMatchEvent(testdb.MatchEventParams{Season: ssn, MatchID: first, Team: lions, Type: db.MatchEventTypeGoal, Player: &martin, OwnGoal: true})
	goal(second, lions, &dupont, &diarra)
	goal(second, bears, &martin, nil)
	goal(second, lions, &diarra, nil)
	for _, other := range []uuid.UUID{live, cancelled, postponed} {
		goal(other, lions, &dupont, &diarra)
	}

	checkResponse(t, get(t, fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/scorers", ssn.LeagueID, ssn.ID)), []wantRow{
		{1, diarra, lions, 2},
		{1, martin, bears, 2},
		{3, dupont, lions, 1},
	})
	checkResponse(t, get(t, fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/assists", ssn.LeagueID, ssn.ID)), []wantRow{
		{1, dupont, lions, 2},
		{2, diarra, lions, 1},
	})
}

func TestRankings_EmptyAndNotFound(t *testing.T) {
	s := testdb.New(t, testPool)
	ssn := s.CreateSeason(testdb.SeasonParams{})
	other := s.CreateLeague(testdb.LeagueParams{})

	for _, name := range []string{"scorers", "assists"} {
		if rows := get(t, fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/%s", ssn.LeagueID, ssn.ID, name)); len(rows) != 0 {
			t.Errorf("%s = %v, want an empty list", name, rows)
		}
		for _, path := range []string{
			fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/%s", other.ID, ssn.ID, name),
			fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/%s", ssn.LeagueID, uuid.New(), name),
		} {
			if rec := testhttp.Do(t, newTestRouter(), http.MethodGet, path, ""); rec.Code != http.StatusNotFound {
				t.Errorf("GET %s: status = %d, want %d", path, rec.Code, http.StatusNotFound)
			}
		}
	}
}
