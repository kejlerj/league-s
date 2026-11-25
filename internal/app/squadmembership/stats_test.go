//go:build integration

package squadmembership

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"league-s/internal/db"
	"league-s/internal/testdb"
	"league-s/internal/testhttp"
)

func TestListSquad_GoalsAndAssistsPerTeamAfterATransfer(t *testing.T) {
	f := newFixture(t)
	third := f.seed.CreateTeam(testdb.TeamParams{})
	f.seed.RegisterTeams(f.season, third)
	mate := f.seed.CreatePlayer(testdb.PlayerParams{})
	f.seed.CreateSquadMember(testdb.SquadMemberParams{Season: f.season, Team: f.home, Player: f.player, JoinedOn: "2025-08-01", LeftOn: "2025-12-31"})
	f.seed.CreateSquadMember(testdb.SquadMemberParams{Season: f.season, Team: f.away, Player: f.player, JoinedOn: "2026-01-01"})
	f.seed.CreateSquadMember(testdb.SquadMemberParams{Season: f.season, Team: f.away, Player: mate})

	finished := func(home, away db.Team, matchday int) uuid.UUID {
		return f.seed.CreateMatch(testdb.MatchParams{Season: f.season, Home: home, Away: away, Matchday: matchday, Status: db.MatchStatusFinished, Score: &testdb.Score{Home: 5, Away: 5}})
	}
	before, after := finished(f.home, third, 1), finished(f.away, third, 2)
	live := f.seed.CreateMatch(testdb.MatchParams{Season: f.season, Home: f.away, Away: third, Matchday: 3, Status: db.MatchStatusLive, Score: &testdb.Score{Home: 1}})

	goal := func(matchID uuid.UUID, team db.Team, scorer, assist *db.Player, ownGoal bool) {
		f.seed.CreateMatchEvent(testdb.MatchEventParams{Season: f.season, MatchID: matchID, Team: team, Type: db.MatchEventTypeGoal, Player: scorer, Assist: assist, OwnGoal: ownGoal})
	}
	goal(before, f.home, &f.player, nil, false)
	goal(before, f.home, &f.player, nil, false)
	goal(after, f.away, &f.player, &mate, false)
	goal(after, f.away, &mate, &f.player, false)
	goal(after, third, &f.player, nil, true)
	goal(live, f.away, &f.player, &mate, false)
	f.seed.CreateMatchEvent(testdb.MatchEventParams{Season: f.season, MatchID: after, Team: f.away, Type: db.MatchEventTypeYellowCard, Player: &f.player})

	stats := func(team db.Team) map[uuid.UUID][2]int32 {
		t.Helper()
		rec := testhttp.Do(t, newTestRouter(), http.MethodGet, f.squadPath(team)+"?all=true", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("list: status = %d, body = %s", rec.Code, rec.Body)
		}
		res := map[uuid.UUID][2]int32{}
		for _, m := range decode[[]memberResponse](t, rec) {
			res[m.PlayerID] = [2]int32{m.Goals, m.Assists}
		}
		return res
	}

	if got := stats(f.home)[f.player.ID]; got != [2]int32{2, 0} {
		t.Errorf("former team: goals and assists = %v, want 2 goals", got)
	}
	away := stats(f.away)
	if got := away[f.player.ID]; got != [2]int32{1, 1} {
		t.Errorf("new team: goals and assists = %v, want 1 and 1: own goals and live matches don't count", got)
	}
	if got := away[mate.ID]; got != [2]int32{1, 1} {
		t.Errorf("team mate: goals and assists = %v, want 1 and 1", got)
	}
}
