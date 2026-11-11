package standing

import (
	"github.com/google/uuid"

	"league-s/internal/app/match"
)

type booked struct {
	matchID, playerID uuid.UUID
}

type cards struct {
	teamID  uuid.UUID
	yellows int
	reds    int
}

func FairPlayPoints(events []match.Event) map[uuid.UUID]int32 {
	byPlayer := map[booked]*cards{}
	for _, e := range events {
		if e.PlayerID == nil || (e.Type != match.EventYellowCard && e.Type != match.EventRedCard) {
			continue
		}
		k := booked{matchID: e.MatchID, playerID: *e.PlayerID}
		c, ok := byPlayer[k]
		if !ok {
			c = &cards{teamID: e.TeamID}
			byPlayer[k] = c
		}
		if e.Type == match.EventRedCard {
			c.reds++
		} else {
			c.yellows++
		}
	}

	res := map[uuid.UUID]int32{}
	for _, c := range byPlayer {
		res[c.teamID] += c.points()
	}
	return res
}

func (c cards) points() int32 {
	switch {
	case c.reds > 0 && c.yellows > 0:
		return 5
	case c.reds > 0:
		return 4
	case c.yellows >= 2:
		return 3
	case c.yellows == 1:
		return 1
	}
	return 0
}
