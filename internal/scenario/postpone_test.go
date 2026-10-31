//go:build integration

package scenario

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"league-s/internal/db"
	"league-s/internal/testdb"
)

func TestScenario_APostponedMatchIsRescheduledThenCountsInTheStandings(t *testing.T) {
	seed := testdb.New(t, testPool)
	league := seed.CreateLeague(testdb.LeagueParams{})
	season := seed.CreateSeason(testdb.SeasonParams{League: &league})
	alpha := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "Alpha"})
	bravo := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "Bravo"})
	charlie := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "Charlie"})
	seed.RegisterTeams(season, alpha, bravo, charlie)

	kickoff := time.Date(2025, time.September, 13, 15, 0, 0, 0, time.UTC)
	postponed := seed.CreateMatch(testdb.MatchParams{Season: season, Home: alpha, Away: bravo, Matchday: 1, KickoffAt: &kickoff})
	played := kickoff.AddDate(0, 0, 7)
	seed.CreateMatch(testdb.MatchParams{
		Season: season, Home: charlie, Away: alpha, Matchday: 2, KickoffAt: &played,
		Status: db.MatchStatusFinished, Score: &testdb.Score{Home: 1, Away: 0},
	})

	admin := loginAsAdminOf(t, league)
	path := fmt.Sprintf("/seasons/%s/matches/%s", season.ID, postponed)

	t.Run("postponing without a date clears the kickoff", func(t *testing.T) {
		var m matchResponse
		admin.send(http.MethodPost, path+"/postpone", map[string]any{}, http.StatusOK, &m)
		if m.Status != "postponed" || m.KickoffAt != nil {
			t.Errorf("match = %+v, want postponed with no kickoff", m)
		}
	})

	t.Run("a postponed match can't be played", func(t *testing.T) {
		admin.send(http.MethodPost, path+"/start", nil, http.StatusConflict, nil)
	})

	t.Run("the standings only count the finished match", func(t *testing.T) {
		checkStandings(t, admin.standings(season.ID), []standingRow{
			{Rank: 1, TeamID: charlie.ID, Played: 1, Won: 1, GoalsFor: 1, GoalDifference: 1, Points: 3},
			{Rank: 2, TeamID: bravo.ID},
			{Rank: 3, TeamID: alpha.ID, Played: 1, Lost: 1, GoalsAgainst: 1, GoalDifference: -1},
		})
	})

	newKickoff := time.Date(2025, time.October, 4, 15, 0, 0, 0, time.UTC)
	t.Run("a new kickoff schedules it again", func(t *testing.T) {
		var m matchResponse
		admin.send(http.MethodPatch, path, map[string]any{"kickoff_at": newKickoff}, http.StatusOK, &m)
		if m.Status != "scheduled" || m.KickoffAt == nil || !m.KickoffAt.Equal(newKickoff) || m.Matchday != 1 {
			t.Errorf("match = %+v, want scheduled on matchday 1 at %s", m, newKickoff)
		}
	})

	admin.play(season.ID, postponed, 2, 1)

	t.Run("once played, it counts in the standings", func(t *testing.T) {
		checkStandings(t, admin.standings(season.ID), []standingRow{
			{Rank: 1, TeamID: charlie.ID, Played: 1, Won: 1, GoalsFor: 1, GoalDifference: 1, Points: 3},
			{Rank: 2, TeamID: alpha.ID, Played: 2, Won: 1, Lost: 1, GoalsFor: 2, GoalsAgainst: 2, Points: 3},
			{Rank: 3, TeamID: bravo.ID, Played: 1, Lost: 1, GoalsFor: 1, GoalsAgainst: 2, GoalDifference: -1},
		})
	})
}
