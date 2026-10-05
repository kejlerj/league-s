//go:build integration

package standing

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
	r.Mount("/api/v1/leagues/{leagueID}/seasons/{seasonID}/standings", h.Routes())
	return r
}

func standingsPath(leagueID, seasonID uuid.UUID) string {
	return fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/standings", leagueID, seasonID)
}

func play(t *testing.T, s db.Season, home, away db.Team, matchday int32, homeGoals, awayGoals int32) {
	t.Helper()
	svc := match.NewService(match.NewPostgresStore(testPool))

	m, err := svc.Schedule(t.Context(), s.LeagueID, s.ID, home.ID, away.ID, matchday, nil, nil)
	if err != nil {
		t.Fatalf("Schedule() error = %v", err)
	}
	if _, err := svc.Start(t.Context(), s.LeagueID, s.ID, m.ID()); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if _, err := svc.SetScore(t.Context(), s.LeagueID, s.ID, m.ID(), homeGoals, awayGoals); err != nil {
		t.Fatalf("SetScore() error = %v", err)
	}
	if _, err := svc.Finish(t.Context(), s.LeagueID, s.ID, m.ID()); err != nil {
		t.Fatalf("Finish() error = %v", err)
	}
}

func TestGetStandings(t *testing.T) {
	s := testdb.New(t, testPool)
	season := s.CreateSeason(testdb.SeasonParams{})
	lions := s.CreateTeam(testdb.TeamParams{Name: "Lions"})
	bears := s.CreateTeam(testdb.TeamParams{Name: "Bears"})
	wolves := s.CreateTeam(testdb.TeamParams{Name: "Wolves"})
	s.RegisterTeams(season, lions, bears, wolves)

	play(t, season, lions, bears, 1, 2, 0)
	play(t, season, bears, wolves, 2, 1, 1)
	if _, err := match.NewService(match.NewPostgresStore(testPool)).Schedule(t.Context(), season.LeagueID, season.ID, wolves.ID, lions.ID, 3, nil, nil); err != nil {
		t.Fatalf("Schedule() error = %v", err)
	}

	rec := testhttp.Do(t, newTestRouter(), http.MethodGet, standingsPath(season.LeagueID, season.ID), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
	}

	var rows []rowResponse
	if err := json.NewDecoder(rec.Body).Decode(&rows); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	want := []rowResponse{
		{Rank: 1, TeamID: lions.ID, TeamName: "Lions", Played: 1, Won: 1, GoalsFor: 2, GoalDifference: 2, Points: 3},
		{Rank: 2, TeamID: wolves.ID, TeamName: "Wolves", Played: 1, Drawn: 1, GoalsFor: 1, GoalsAgainst: 1, Points: 1},
		{Rank: 3, TeamID: bears.ID, TeamName: "Bears", Played: 2, Drawn: 1, Lost: 1, GoalsFor: 1, GoalsAgainst: 3, GoalDifference: -2, Points: 1},
	}
	if len(rows) != len(want) {
		t.Fatalf("standings have %d rows, want %d: %+v", len(rows), len(want), rows)
	}
	for i := range want {
		if rows[i] != want[i] {
			t.Errorf("row %d = %+v, want %+v", i+1, rows[i], want[i])
		}
	}
}

func TestGetStandings_SeasonWithoutMatches(t *testing.T) {
	s := testdb.New(t, testPool)
	season := s.CreateSeason(testdb.SeasonParams{})
	s.RegisterTeams(season, s.CreateTeam(testdb.TeamParams{Name: "Bears"}), s.CreateTeam(testdb.TeamParams{Name: "Lions"}))

	rec := testhttp.Do(t, newTestRouter(), http.MethodGet, standingsPath(season.LeagueID, season.ID), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
	}

	var rows []rowResponse
	if err := json.NewDecoder(rec.Body).Decode(&rows); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(rows) != 2 || rows[0].TeamName != "Bears" || rows[0].Played != 0 {
		t.Errorf("rows = %+v, want every registered team with an empty row", rows)
	}
}

func TestGetStandings_Errors(t *testing.T) {
	s := testdb.New(t, testPool)
	season := s.CreateSeason(testdb.SeasonParams{})
	other := s.CreateLeague(testdb.LeagueParams{})

	tests := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{"unknown season", standingsPath(season.LeagueID, uuid.New()), http.StatusNotFound},
		{"season of another league", standingsPath(other.ID, season.ID), http.StatusNotFound},
		{"invalid season id", fmt.Sprintf("/api/v1/leagues/%s/seasons/abc/standings", season.LeagueID), http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := testhttp.Do(t, newTestRouter(), http.MethodGet, tt.path, ""); rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
		})
	}
}
