//go:build integration

package scenario

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"league-s/internal/testdb"
)

func TestScenario_AFinishedMatchScoreIsCorrectedAndTheStandingsFollow(t *testing.T) {
	seed := testdb.New(t, testPool)
	league := seed.CreateLeague(testdb.LeagueParams{})
	season := seed.CreateSeason(testdb.SeasonParams{League: &league})
	alpha := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "Alpha"})
	bravo := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "Bravo"})
	seed.RegisterTeams(season, alpha, bravo)

	kickoff := time.Date(2025, time.September, 13, 15, 0, 0, 0, time.UTC)
	played := seed.CreateMatch(testdb.MatchParams{Season: season, Home: alpha, Away: bravo, Matchday: 1, KickoffAt: &kickoff})
	cancelled := seed.CreateMatch(testdb.MatchParams{Season: season, Home: bravo, Away: alpha, Matchday: 2, KickoffAt: &kickoff})

	admin := loginAsAdminOf(t, league)
	admin.play(season.ID, played, 2, 1)
	path := fmt.Sprintf("/seasons/%s/matches/%s", season.ID, played)

	t.Run("the standings count the first score", func(t *testing.T) {
		checkStandings(t, admin.standings(season.ID), []standingRow{
			{Rank: 1, TeamID: alpha.ID, Played: 1, Won: 1, GoalsFor: 2, GoalsAgainst: 1, GoalDifference: 1, Points: 3},
			{Rank: 2, TeamID: bravo.ID, Played: 1, Lost: 1, GoalsFor: 1, GoalsAgainst: 2, GoalDifference: -1},
		})
	})

	t.Run("correcting the score keeps the match finished", func(t *testing.T) {
		var m matchResponse
		admin.send(http.MethodPut, path+"/score", map[string]int32{"home": 1, "away": 3}, http.StatusOK, &m)
		if m.Status != "finished" || m.HomeScore == nil || *m.HomeScore != 1 || m.AwayScore == nil || *m.AwayScore != 3 {
			t.Errorf("match = %+v, want finished 1-3", m)
		}
	})

	t.Run("the standings follow the correction", func(t *testing.T) {
		checkStandings(t, admin.standings(season.ID), []standingRow{
			{Rank: 1, TeamID: bravo.ID, Played: 1, Won: 1, GoalsFor: 3, GoalsAgainst: 1, GoalDifference: 2, Points: 3},
			{Rank: 2, TeamID: alpha.ID, Played: 1, Lost: 1, GoalsFor: 1, GoalsAgainst: 3, GoalDifference: -2},
		})
	})

	t.Run("a negative correction is refused", func(t *testing.T) {
		admin.send(http.MethodPut, path+"/score", map[string]int32{"home": -1, "away": 3}, http.StatusUnprocessableEntity, nil)
	})

	t.Run("a cancelled match still refuses a score", func(t *testing.T) {
		cancelledPath := fmt.Sprintf("/seasons/%s/matches/%s", season.ID, cancelled)
		admin.send(http.MethodPost, cancelledPath+"/cancel", nil, http.StatusOK, nil)
		admin.send(http.MethodPut, cancelledPath+"/score", map[string]int32{"home": 1, "away": 0}, http.StatusConflict, nil)
	})
}
