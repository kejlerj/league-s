package standing

import (
	"cmp"
	"slices"

	"github.com/google/uuid"

	"league-s/internal/app/match"
)

const (
	TieBreakerGoalDifference = "goal_difference"
	TieBreakerGoalsScored    = "goals_scored"
	TieBreakerHeadToHead     = "head_to_head"
)

type Rules struct {
	WinPts      int32
	DrawPts     int32
	LossPts     int32
	TieBreakers []string
}

type Team struct {
	ID   uuid.UUID
	Name string
}

type Row struct {
	Rank           int
	TeamID         uuid.UUID
	TeamName       string
	Played         int32
	Won            int32
	Drawn          int32
	Lost           int32
	GoalsFor       int32
	GoalsAgainst   int32
	GoalDifference int32
	Points         int32
}

type result struct {
	home, away           uuid.UUID
	homeGoals, awayGoals int32
}

func Compute(teams []Team, matches []*match.Match, rules Rules) []Row {
	results := finished(matches)

	rows := make([]*Row, len(teams))
	for i, t := range teams {
		rows[i] = &Row{TeamID: t.ID, TeamName: t.Name}
	}
	tally(rows, results, rules)

	ranked := rank(rows, results, rules, 0)

	res := make([]Row, len(ranked))
	for i, r := range ranked {
		r.Rank = i + 1
		res[i] = *r
	}
	return res
}

func finished(matches []*match.Match) []result {
	var results []result
	for _, m := range matches {
		if _, _, err := m.Winner(); err != nil {
			continue
		}
		score := m.Score()
		results = append(results, result{
			home:      m.HomeTeamID(),
			away:      m.AwayTeamID(),
			homeGoals: score.Home,
			awayGoals: score.Away,
		})
	}
	return results
}

func tally(rows []*Row, results []result, rules Rules) {
	byTeam := make(map[uuid.UUID]*Row, len(rows))
	for _, r := range rows {
		byTeam[r.TeamID] = r
	}

	for _, res := range results {
		home, away := byTeam[res.home], byTeam[res.away]
		if home == nil || away == nil {
			continue
		}

		record(home, res.homeGoals, res.awayGoals, rules)
		record(away, res.awayGoals, res.homeGoals, rules)
	}
}

func record(r *Row, scored, conceded int32, rules Rules) {
	r.Played++
	r.GoalsFor += scored
	r.GoalsAgainst += conceded
	r.GoalDifference = r.GoalsFor - r.GoalsAgainst

	switch {
	case scored > conceded:
		r.Won++
		r.Points += rules.WinPts
	case scored == conceded:
		r.Drawn++
		r.Points += rules.DrawPts
	default:
		r.Lost++
		r.Points += rules.LossPts
	}
}

type key [2]int32

func rank(group []*Row, results []result, rules Rules, step int) []*Row {
	if len(group) < 2 {
		return group
	}
	if step > len(rules.TieBreakers) {
		slices.SortStableFunc(group, func(a, b *Row) int { return cmp.Compare(a.TeamName, b.TeamName) })
		return group
	}

	keys := keysFor(group, results, rules, step)
	slices.SortStableFunc(group, func(a, b *Row) int {
		ka, kb := keys[a.TeamID], keys[b.TeamID]
		return cmp.Or(cmp.Compare(kb[0], ka[0]), cmp.Compare(kb[1], ka[1]))
	})

	if keys[group[0].TeamID] == keys[group[len(group)-1].TeamID] {
		return rank(group, results, rules, step+1)
	}

	ranked := make([]*Row, 0, len(group))
	for start := 0; start < len(group); {
		end := start + 1
		for end < len(group) && keys[group[end].TeamID] == keys[group[start].TeamID] {
			end++
		}
		ranked = append(ranked, rank(group[start:end], results, rules, max(step, 1))...)
		start = end
	}
	return ranked
}

func keysFor(group []*Row, results []result, rules Rules, step int) map[uuid.UUID]key {
	keys := make(map[uuid.UUID]key, len(group))

	if step == 0 {
		for _, r := range group {
			keys[r.TeamID] = key{r.Points}
		}
		return keys
	}

	switch rules.TieBreakers[step-1] {
	case TieBreakerGoalDifference:
		for _, r := range group {
			keys[r.TeamID] = key{r.GoalDifference}
		}
	case TieBreakerGoalsScored:
		for _, r := range group {
			keys[r.TeamID] = key{r.GoalsFor}
		}
	case TieBreakerHeadToHead:
		mini := make([]*Row, len(group))
		for i, r := range group {
			mini[i] = &Row{TeamID: r.TeamID}
		}
		tally(mini, results, rules)
		for _, r := range mini {
			keys[r.TeamID] = key{r.Points, r.GoalDifference}
		}
	default:
		for _, r := range group {
			keys[r.TeamID] = key{}
		}
	}
	return keys
}
