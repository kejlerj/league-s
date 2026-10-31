//go:build integration

package scenario

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"league-s/internal/db"
	"league-s/internal/testdb"
)

func TestScenario_AMidSeasonTransferMovesThePlayerOnceTheNewSquadHasRoom(t *testing.T) {
	seed := testdb.New(t, testPool)
	league := seed.CreateLeague(testdb.LeagueParams{})
	season := seed.CreateSeason(testdb.SeasonParams{League: &league, MaxSquadSize: 2})
	from := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "From"})
	to := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "To"})
	seed.RegisterTeams(season, from, to)

	player := func(team db.Team, number int32) db.SquadMembership {
		p := seed.CreatePlayer(testdb.PlayerParams{League: &league})
		return seed.CreateSquadMember(testdb.SquadMemberParams{Season: season, Team: team, Player: p, Number: number})
	}
	moving := player(from, 9)
	staying := player(from, 4)
	keeper := player(to, 1)
	leaving := player(to, 7)

	admin := loginAsAdminOf(t, league)
	squad := func(team db.Team, query string) map[uuid.UUID]squadMember {
		t.Helper()
		var members []squadMember
		admin.send(http.MethodGet, fmt.Sprintf("/seasons/%s/teams/%s/squad%s", season.ID, team.ID, query), nil, http.StatusOK, &members)
		res := make(map[uuid.UUID]squadMember, len(members))
		for _, m := range members {
			res[m.PlayerID] = m
		}
		return res
	}
	transfer := map[string]any{
		"player_id":    moving.PlayerID,
		"from_team_id": from.ID,
		"to_team_id":   to.ID,
		"number":       10,
		"on":           "2025-11-15",
	}

	t.Run("a transfer into a full squad changes nothing", func(t *testing.T) {
		admin.send(http.MethodPost, fmt.Sprintf("/seasons/%s/transfers", season.ID), transfer, http.StatusConflict, nil)

		if m, ok := squad(from, "")[moving.PlayerID]; !ok || m.LeftOn != nil {
			t.Errorf("player in the old squad = %+v (found %t), want still active", m, ok)
		}
		if got := len(squad(to, "")); got != 2 {
			t.Errorf("new squad has %d members, want 2", got)
		}
	})

	admin.send(http.MethodPost, fmt.Sprintf("/seasons/%s/teams/%s/squad/%s/leave", season.ID, to.ID, leaving.ID),
		map[string]string{"left_on": "2025-11-10"}, http.StatusOK, nil)

	t.Run("once a player left, the transfer goes through", func(t *testing.T) {
		admin.send(http.MethodPost, fmt.Sprintf("/seasons/%s/transfers", season.ID), transfer, http.StatusCreated, nil)

		oldSquad := squad(from, "")
		if _, ok := oldSquad[moving.PlayerID]; ok || len(oldSquad) != 1 {
			t.Errorf("old squad = %+v, want only the player who stayed (%s)", oldSquad, staying.PlayerID)
		}

		history := squad(from, "?all=true")[moving.PlayerID]
		if history.LeftOn == nil || *history.LeftOn != "2025-11-15" {
			t.Errorf("old membership left_on = %v, want 2025-11-15", history.LeftOn)
		}

		newSquad := squad(to, "")
		arrived, ok := newSquad[moving.PlayerID]
		if !ok || arrived.Number == nil || *arrived.Number != 10 || arrived.JoinedOn != "2025-11-15" {
			t.Errorf("player in the new squad = %+v (found %t), want number 10 from 2025-11-15", arrived, ok)
		}
		if _, ok := newSquad[keeper.PlayerID]; !ok || len(newSquad) != 2 {
			t.Errorf("new squad = %+v, want the keeper and the new player", newSquad)
		}
	})
}
