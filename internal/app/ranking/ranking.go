package ranking

import (
	"cmp"
	"slices"

	"github.com/google/uuid"

	"league-s/internal/app/match"
)

type Row struct {
	Rank      int
	PlayerID  uuid.UUID
	Firstname string
	Lastname  string
	TeamID    uuid.UUID
	Value     int32
}

func scorer(e match.EventView) *match.PlayerName {
	if e.Type != match.EventGoal || e.OwnGoal {
		return nil
	}
	return e.Player
}

func assist(e match.EventView) *match.PlayerName {
	if e.Type != match.EventGoal {
		return nil
	}
	return e.AssistPlayer
}

func Scorers(events []match.EventView) []Row {
	return build(events, scorer)
}

func Assists(events []match.EventView) []Row {
	return build(events, assist)
}

func build(events []match.EventView, counted func(match.EventView) *match.PlayerName) []Row {
	teams := lastTeams(events)
	rows := map[uuid.UUID]*Row{}

	for _, e := range events {
		p := counted(e)
		if p == nil {
			continue
		}
		row, ok := rows[p.ID]
		if !ok {
			row = &Row{PlayerID: p.ID, Firstname: p.Firstname, Lastname: p.Lastname, TeamID: teams[p.ID]}
			rows[p.ID] = row
		}
		row.Value++
	}

	res := make([]Row, 0, len(rows))
	for _, r := range rows {
		res = append(res, *r)
	}
	slices.SortFunc(res, func(a, b Row) int {
		return cmp.Or(cmp.Compare(b.Value, a.Value), cmp.Compare(a.Lastname, b.Lastname), cmp.Compare(a.Firstname, b.Firstname), cmp.Compare(a.PlayerID.String(), b.PlayerID.String()))
	})
	for i := range res {
		res[i].Rank = i + 1
		if i > 0 && res[i].Value == res[i-1].Value {
			res[i].Rank = res[i-1].Rank
		}
	}
	return res
}

func lastTeams(events []match.EventView) map[uuid.UUID]uuid.UUID {
	teams := map[uuid.UUID]uuid.UUID{}
	for _, e := range events {
		for _, p := range []*match.PlayerName{scorer(e), assist(e)} {
			if p != nil {
				teams[p.ID] = e.TeamID
			}
		}
	}
	return teams
}
