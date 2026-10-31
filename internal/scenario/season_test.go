//go:build integration

package scenario

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"league-s/internal/testdb"
)

func TestScenario_AFullSeasonIsPlayedThroughTheAPIUpToTheStandings(t *testing.T) {
	seed := testdb.New(t, testPool)
	admin := loginAsAdminOf(t, seed.CreateLeague(testdb.LeagueParams{}))

	teams := map[string]uuid.UUID{}
	for _, name := range []string{"Alpha", "Bravo", "Charlie", "Delta"} {
		var team created
		admin.send(http.MethodPost, "/teams", map[string]string{"name": name}, http.StatusCreated, &team)
		teams[name] = team.ID
	}

	var season created
	admin.send(http.MethodPost, "/seasons", map[string]any{
		"name":         "2026-2027",
		"start_on":     "2026-08-01",
		"end_on":       "2027-05-31",
		"tie_breakers": []string{"goal_difference", "goals_scored"},
	}, http.StatusCreated, &season)
	for _, id := range teams {
		admin.send(http.MethodPost, fmt.Sprintf("/seasons/%s/teams/%s", season.ID, id), nil, http.StatusCreated, nil)
	}

	fixtures := []struct {
		matchday   int32
		home, away string
		homeGoals  int32
		awayGoals  int32
	}{
		{1, "Alpha", "Bravo", 2, 0},
		{1, "Charlie", "Delta", 1, 1},
		{2, "Alpha", "Charlie", 0, 1},
		{2, "Bravo", "Delta", 3, 1},
		{3, "Delta", "Alpha", 0, 0},
		{3, "Bravo", "Charlie", 2, 2},
	}
	firstSaturday := time.Date(2026, time.September, 5, 15, 0, 0, 0, time.UTC)

	matches := make([]created, len(fixtures))
	for i, f := range fixtures {
		admin.send(http.MethodPost, fmt.Sprintf("/seasons/%s/matches", season.ID), map[string]any{
			"home_team_id": teams[f.home],
			"away_team_id": teams[f.away],
			"matchday":     f.matchday,
			"kickoff_at":   firstSaturday.AddDate(0, 0, 7*int(f.matchday-1)),
		}, http.StatusCreated, &matches[i])
	}

	for i, f := range fixtures[:4] {
		admin.play(season.ID, matches[i].ID, f.homeGoals, f.awayGoals)
	}
	live := fmt.Sprintf("/seasons/%s/matches/%s", season.ID, matches[4].ID)
	admin.send(http.MethodPost, live+"/start", nil, http.StatusOK, nil)
	admin.send(http.MethodPut, live+"/score", map[string]int32{"home": 3, "away": 0}, http.StatusOK, nil)

	t.Run("a live match does not count yet", func(t *testing.T) {
		for _, row := range admin.standings(season.ID) {
			if row.Played != 2 {
				t.Errorf("team %s played = %d, want 2 after two finished matchdays", row.TeamID, row.Played)
			}
		}
	})

	admin.send(http.MethodPut, live+"/score", map[string]int32{"home": 0, "away": 0}, http.StatusOK, nil)
	admin.send(http.MethodPost, live+"/finish", nil, http.StatusOK, nil)
	admin.play(season.ID, matches[5].ID, fixtures[5].homeGoals, fixtures[5].awayGoals)

	t.Run("every match is finished", func(t *testing.T) {
		var finished []matchResponse
		admin.send(http.MethodGet, fmt.Sprintf("/seasons/%s/matches?status=finished", season.ID), nil, http.StatusOK, &finished)
		if len(finished) != len(fixtures) {
			t.Errorf("finished matches = %d, want %d", len(finished), len(fixtures))
		}
	})

	t.Run("the standings rank by points, then goal difference", func(t *testing.T) {
		checkStandings(t, admin.standings(season.ID), []standingRow{
			{Rank: 1, TeamID: teams["Charlie"], Played: 3, Won: 1, Drawn: 2, GoalsFor: 4, GoalsAgainst: 3, GoalDifference: 1, Points: 5},
			{Rank: 2, TeamID: teams["Alpha"], Played: 3, Won: 1, Drawn: 1, Lost: 1, GoalsFor: 2, GoalsAgainst: 1, GoalDifference: 1, Points: 4},
			{Rank: 3, TeamID: teams["Bravo"], Played: 3, Won: 1, Drawn: 1, Lost: 1, GoalsFor: 5, GoalsAgainst: 5, Points: 4},
			{Rank: 4, TeamID: teams["Delta"], Played: 3, Drawn: 2, Lost: 1, GoalsFor: 2, GoalsAgainst: 4, GoalDifference: -2, Points: 2},
		})
	})
}
