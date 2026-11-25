package standing

import (
	"slices"
	"testing"

	"github.com/google/uuid"

	"league-s/internal/app/match"
)

func booking(matchID, teamID, playerID uuid.UUID, typ match.EventType) match.Event {
	return match.Event{ID: uuid.New(), MatchID: matchID, TeamID: teamID, Type: typ, Minute: 30, PlayerID: &playerID}
}

func TestFairPlayPoints_PerPlayerAndPerMatch(t *testing.T) {
	yellow, red := match.EventYellowCard, match.EventRedCard

	tests := []struct {
		name  string
		cards []match.EventType
		want  int32
	}{
		{"one yellow", []match.EventType{yellow}, 1},
		{"two yellows", []match.EventType{yellow, yellow}, 3},
		{"a direct red", []match.EventType{red}, 4},
		{"a yellow then a direct red", []match.EventType{yellow, red}, 5},
		{"no card", nil, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matchID, team, player := uuid.New(), uuid.New(), uuid.New()
			var events []match.Event
			for _, c := range tt.cards {
				events = append(events, booking(matchID, team, player, c))
			}

			if got := FairPlayPoints(events)[team]; got != tt.want {
				t.Errorf("points = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestFairPlayPoints_AddsUpPlayersAndMatches(t *testing.T) {
	first, second := uuid.New(), uuid.New()
	home, away := uuid.New(), uuid.New()
	player, other, rival := uuid.New(), uuid.New(), uuid.New()
	scorer := uuid.New()

	events := []match.Event{
		booking(first, home, player, match.EventYellowCard),
		booking(first, home, other, match.EventYellowCard),
		booking(second, home, player, match.EventYellowCard),
		booking(first, away, rival, match.EventRedCard),
		booking(first, away, rival, match.EventInjury),
		{ID: uuid.New(), MatchID: first, TeamID: away, Type: match.EventGoal, Minute: 3, PlayerID: &scorer},
	}

	got := FairPlayPoints(events)
	if got[home] != 3 || got[away] != 4 {
		t.Errorf("points = %v, want home 3 (three single yellows), away 4", got)
	}
}

func TestCompute_FairPlay(t *testing.T) {
	teams := newTeams("A", "B", "C")
	a, b, c := teams["A"], teams["B"], teams["C"]
	a.FairPlayPoints, b.FairPlayPoints, c.FairPlayPoints = 5, 1, 0
	matches := []*match.Match{
		played(t, a, b, 1, 1),
		played(t, c, a, 0, 3),
		played(t, c, b, 0, 3),
	}

	rows := Compute([]Team{a, b, c}, matches, Rules{WinPts: 3, DrawPts: 1, TieBreakers: []string{TieBreakerFairPlay, TieBreakerGoalDifference}})

	if got := order(rows); !slices.Equal(got, []string{"B", "A", "C"}) {
		t.Errorf("order = %v, want B before A: fewer fair-play points", got)
	}
	for _, r := range rows {
		if want := map[string]int32{"A": 5, "B": 1, "C": 0}[r.TeamName]; r.FairPlayPoints != want {
			t.Errorf("%s: fair_play_points = %d, want %d", r.TeamName, r.FairPlayPoints, want)
		}
	}
}

func TestCompute_FairPlayAppliesInTheSeasonOrder(t *testing.T) {
	teams := newTeams("A", "B")
	a, b := teams["A"], teams["B"]
	a.FairPlayPoints, b.FairPlayPoints = 0, 9
	matches := []*match.Match{
		played(t, a, b, 1, 1),
		played(t, b, a, 4, 2),
		played(t, a, b, 1, 0),
	}

	rows := Compute([]Team{a, b}, matches, Rules{WinPts: 3, DrawPts: 1, TieBreakers: []string{TieBreakerGoalsScored, TieBreakerFairPlay}})

	if got := order(rows); !slices.Equal(got, []string{"B", "A"}) {
		t.Errorf("order = %v, want B first on goals scored before fair play applies", got)
	}
}
