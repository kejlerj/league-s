//go:build integration

package standing

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"league-s/internal/db"
	"league-s/internal/testdb"
	"league-s/internal/testhttp"
)

func TestGetStandings_FairPlay(t *testing.T) {
	s := testdb.New(t, testPool)
	ssn := s.CreateSeason(testdb.SeasonParams{})
	if _, err := testPool.Exec(context.Background(), `UPDATE season SET tie_breakers = '{fair_play,goal_difference}' WHERE id = $1`, ssn.ID); err != nil {
		t.Fatalf("set tie-breakers: %v", err)
	}
	lions, bears := s.CreateTeam(testdb.TeamParams{Name: "Lions"}), s.CreateTeam(testdb.TeamParams{Name: "Bears"})
	s.RegisterTeams(ssn, lions, bears)
	rough, calm, other := s.CreatePlayer(testdb.PlayerParams{}), s.CreatePlayer(testdb.PlayerParams{}), s.CreatePlayer(testdb.PlayerParams{})

	draw := s.CreateMatch(testdb.MatchParams{Season: ssn, Home: bears, Away: lions, Matchday: 1, Status: db.MatchStatusFinished, Score: &testdb.Score{Home: 1, Away: 1}})
	live := s.CreateMatch(testdb.MatchParams{Season: ssn, Home: lions, Away: bears, Matchday: 2, Status: db.MatchStatusLive, Score: &testdb.Score{}})
	postponed := s.CreateMatch(testdb.MatchParams{Season: ssn, Home: lions, Away: bears, Matchday: 3, Status: db.MatchStatusPostponed, Score: &testdb.Score{}})

	book := func(matchID uuid.UUID, team db.Team, player db.Player, typ db.MatchEventType) {
		s.CreateMatchEvent(testdb.MatchEventParams{Season: ssn, MatchID: matchID, Team: team, Type: typ, Player: &player})
	}
	book(draw, bears, rough, db.MatchEventTypeYellowCard)
	book(draw, bears, rough, db.MatchEventTypeRedCard)
	book(draw, lions, calm, db.MatchEventTypeYellowCard)
	for _, m := range []uuid.UUID{live, postponed} {
		book(m, lions, other, db.MatchEventTypeRedCard)
		book(m, lions, calm, db.MatchEventTypeRedCard)
	}

	rec := testhttp.Do(t, newTestRouter(), http.MethodGet, standingsPath(ssn.LeagueID, ssn.ID), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	var rows []rowResponse
	if err := json.NewDecoder(rec.Body).Decode(&rows); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(rows) != 2 || rows[0].TeamID != lions.ID || rows[1].TeamID != bears.ID {
		t.Fatalf("rows = %+v, want Lions first: fewer fair-play points", rows)
	}
	if rows[0].FairPlayPoints != 1 || rows[1].FairPlayPoints != 5 {
		t.Errorf("fair_play_points = %d and %d, want 1 and 5: only finished matches count", rows[0].FairPlayPoints, rows[1].FairPlayPoints)
	}
}
