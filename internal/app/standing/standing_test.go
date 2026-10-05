package standing

import (
	"slices"
	"testing"

	"github.com/google/uuid"

	"league-s/internal/app/match"
)

var defaultRules = Rules{WinPts: 3, DrawPts: 1, LossPts: 0}

func newTeams(names ...string) map[string]Team {
	teams := make(map[string]Team, len(names))
	for _, name := range names {
		teams[name] = Team{ID: uuid.New(), Name: name}
	}
	return teams
}

func list(teams map[string]Team) []Team {
	res := make([]Team, 0, len(teams))
	for _, t := range teams {
		res = append(res, t)
	}
	slices.SortFunc(res, func(a, b Team) int { return -1 * compareNames(a, b) })
	return res
}

func compareNames(a, b Team) int {
	switch {
	case a.Name < b.Name:
		return -1
	case a.Name > b.Name:
		return 1
	}
	return 0
}

func scheduled(t *testing.T, home, away Team) *match.Match {
	t.Helper()
	m, err := match.New(uuid.New(), home.ID, away.ID, 1, nil)
	if err != nil {
		t.Fatalf("match.New() error = %v", err)
	}
	return m
}

func played(t *testing.T, home, away Team, homeGoals, awayGoals int32) *match.Match {
	t.Helper()
	m := scheduled(t, home, away)
	if err := m.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if err := m.SetScore(homeGoals, awayGoals); err != nil {
		t.Fatalf("SetScore() error = %v", err)
	}
	if err := m.Finish(); err != nil {
		t.Fatalf("Finish() error = %v", err)
	}
	return m
}

func order(rows []Row) []string {
	names := make([]string, len(rows))
	for i, r := range rows {
		names[i] = r.TeamName
	}
	return names
}

func TestCompute_CountsEveryColumn(t *testing.T) {
	teams := newTeams("A", "B", "C")
	matches := []*match.Match{
		played(t, teams["A"], teams["B"], 3, 1),
		played(t, teams["B"], teams["C"], 2, 2),
		played(t, teams["C"], teams["A"], 0, 1),
	}

	rows := Compute(list(teams), matches, defaultRules)

	want := []Row{
		{Rank: 1, TeamID: teams["A"].ID, TeamName: "A", Played: 2, Won: 2, GoalsFor: 4, GoalsAgainst: 1, GoalDifference: 3, Points: 6},
		{Rank: 2, TeamID: teams["B"].ID, TeamName: "B", Played: 2, Drawn: 1, Lost: 1, GoalsFor: 3, GoalsAgainst: 5, GoalDifference: -2, Points: 1},
		{Rank: 3, TeamID: teams["C"].ID, TeamName: "C", Played: 2, Drawn: 1, Lost: 1, GoalsFor: 2, GoalsAgainst: 3, GoalDifference: -1, Points: 1},
	}
	if !slices.Equal(rows, want) {
		t.Errorf("rows =\n%+v\nwant\n%+v", rows, want)
	}
}

func TestCompute_OnlyFinishedMatchesCount(t *testing.T) {
	teams := newTeams("A", "B")
	live := scheduled(t, teams["A"], teams["B"])
	if err := live.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if err := live.SetScore(5, 0); err != nil {
		t.Fatalf("SetScore() error = %v", err)
	}
	cancelled := scheduled(t, teams["A"], teams["B"])
	if err := cancelled.Cancel(); err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}

	rows := Compute(list(teams), []*match.Match{live, cancelled, scheduled(t, teams["B"], teams["A"])}, defaultRules)

	for _, r := range rows {
		if r.Played != 0 || r.Points != 0 || r.GoalsFor != 0 {
			t.Errorf("row = %+v, want an empty row: no match is finished", r)
		}
	}
	if got := order(rows); !slices.Equal(got, []string{"A", "B"}) {
		t.Errorf("order = %v, want teams by name when nothing separates them", got)
	}
}

func TestCompute_UsesThePointsOfTheSeason(t *testing.T) {
	teams := newTeams("A", "B", "C")
	matches := []*match.Match{
		played(t, teams["A"], teams["B"], 1, 0),
		played(t, teams["A"], teams["C"], 0, 1),
		played(t, teams["B"], teams["C"], 1, 1),
	}

	rows := Compute(list(teams), matches, Rules{WinPts: 2, DrawPts: 1, LossPts: 0})

	points := map[string]int32{}
	for _, r := range rows {
		points[r.TeamName] = r.Points
	}
	if points["A"] != 2 || points["B"] != 1 || points["C"] != 3 {
		t.Errorf("points = %v, want A=2 B=1 C=3 with 2 points for a win", points)
	}
}

func TestCompute_TieBreakers(t *testing.T) {
	tests := []struct {
		name        string
		tieBreakers []string
		matches     func(teams map[string]Team) []*match.Match
		want        []string
	}{
		{
			name:        "goal difference",
			tieBreakers: []string{TieBreakerGoalDifference},
			matches: func(teams map[string]Team) []*match.Match {
				return []*match.Match{
					played(t, teams["A"], teams["C"], 1, 0),
					played(t, teams["B"], teams["C"], 4, 0),
				}
			},
			want: []string{"B", "A", "C"},
		},
		{
			name:        "goals scored when the goal difference is equal",
			tieBreakers: []string{TieBreakerGoalDifference, TieBreakerGoalsScored},
			matches: func(teams map[string]Team) []*match.Match {
				return []*match.Match{
					played(t, teams["A"], teams["C"], 1, 0),
					played(t, teams["B"], teams["C"], 3, 2),
				}
			},
			want: []string{"B", "A", "C"},
		},
		{
			name:        "the order of the season decides which rule comes first",
			tieBreakers: []string{TieBreakerGoalsScored, TieBreakerGoalDifference},
			matches: func(teams map[string]Team) []*match.Match {
				return []*match.Match{
					played(t, teams["A"], teams["C"], 2, 0),
					played(t, teams["B"], teams["C"], 3, 2),
				}
			},
			want: []string{"B", "A", "C"},
		},
		{
			name:        "head to head between two teams",
			tieBreakers: []string{TieBreakerHeadToHead, TieBreakerGoalDifference},
			matches: func(teams map[string]Team) []*match.Match {
				return []*match.Match{
					played(t, teams["B"], teams["A"], 1, 0),
					played(t, teams["A"], teams["C"], 5, 0),
				}
			},
			want: []string{"B", "A", "C"},
		},
		{
			name:        "head to head between three teams uses only the matches between them",
			tieBreakers: []string{TieBreakerHeadToHead},
			matches: func(teams map[string]Team) []*match.Match {
				return []*match.Match{
					played(t, teams["A"], teams["B"], 1, 0),
					played(t, teams["B"], teams["C"], 3, 0),
					played(t, teams["C"], teams["A"], 1, 0),
					played(t, teams["A"], teams["D"], 9, 0),
					played(t, teams["B"], teams["D"], 1, 0),
					played(t, teams["C"], teams["D"], 1, 0),
				}
			},
			want: []string{"B", "A", "C", "D"},
		},
		{
			name:        "unknown rules are skipped and the name decides last",
			tieBreakers: []string{"fair_play", "random"},
			matches: func(teams map[string]Team) []*match.Match {
				return []*match.Match{played(t, teams["B"], teams["A"], 1, 1)}
			},
			want: []string{"A", "B", "C"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			names := []string{"A", "B", "C"}
			if len(tt.want) == 4 {
				names = append(names, "D")
			}
			teams := newTeams(names...)

			rules := defaultRules
			rules.TieBreakers = tt.tieBreakers
			rows := Compute(list(teams), tt.matches(teams), rules)

			if got := order(rows); !slices.Equal(got, tt.want) {
				t.Errorf("order = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCompute_NoTeams(t *testing.T) {
	if rows := Compute(nil, nil, defaultRules); len(rows) != 0 {
		t.Errorf("rows = %+v, want none", rows)
	}
}
