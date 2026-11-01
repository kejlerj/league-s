package match

import (
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

type EventType string

const (
	EventGoal         EventType = "goal"
	EventYellowCard   EventType = "yellow_card"
	EventRedCard      EventType = "red_card"
	EventSubstitution EventType = "substitution"
	EventInjury       EventType = "injury"
)

const (
	minEventMinute = 1
	maxEventMinute = 150
	maxNoteLength  = 200
)

type Event struct {
	ID             uuid.UUID
	MatchID        uuid.UUID
	TeamID         uuid.UUID
	Type           EventType
	Minute         int32
	PlayerID       *uuid.UUID
	AssistPlayerID *uuid.UUID
	PlayerInID     *uuid.UUID
	OwnGoal        bool
	Penalty        bool
	Note           *string
}

func (e Event) Clean() (Event, error) {
	switch e.Type {
	case EventGoal, EventYellowCard, EventRedCard, EventSubstitution, EventInjury:
	default:
		return e, ErrEventInvalidType
	}
	if e.Minute < minEventMinute || e.Minute > maxEventMinute {
		return e, ErrEventInvalidMinute
	}
	if e.Type != EventGoal {
		switch {
		case e.OwnGoal:
			return e, ErrEventOwnGoalNotGoal
		case e.Penalty:
			return e, ErrEventPenaltyNotGoal
		case e.AssistPlayerID != nil:
			return e, ErrEventAssistNotGoal
		}
	}
	if e.AssistPlayerID != nil && (e.Penalty || e.OwnGoal) {
		return e, ErrEventAssistOnSetPiece
	}
	if e.AssistPlayerID != nil && e.PlayerID != nil && *e.AssistPlayerID == *e.PlayerID {
		return e, ErrEventAssistIsScorer
	}
	if e.Type != EventGoal && e.PlayerID == nil {
		return e, ErrEventPlayerRequired
	}
	if e.Type == EventSubstitution {
		if e.PlayerInID == nil {
			return e, ErrEventPlayerInRequired
		}
		if *e.PlayerInID == *e.PlayerID {
			return e, ErrEventPlayerInIsPlayer
		}
	} else if e.PlayerInID != nil {
		return e, ErrEventPlayerInNotSubstitution
	}
	if e.Note != nil {
		if e.Type != EventInjury {
			return e, ErrEventNoteNotInjury
		}
		note := strings.TrimSpace(*e.Note)
		if length := utf8.RuneCountInString(note); length < 1 || length > maxNoteLength {
			return e, ErrEventNoteLength
		}
		e.Note = &note
	}
	return e, nil
}

func (e Event) SquadTeamID(m *Match) uuid.UUID {
	if e.OwnGoal {
		return m.opponentOf(e.TeamID)
	}
	return e.TeamID
}

func (m *Match) opponentOf(teamID uuid.UUID) uuid.UUID {
	if teamID == m.homeTeamID {
		return m.awayTeamID
	}
	return m.homeTeamID
}

func (m *Match) hasEvents() bool {
	return m.status == StatusLive || m.status == StatusFinished
}

func (m *Match) RecordEvent(e Event, existing []Event) error {
	if !m.hasEvents() {
		return ErrEventMatchNotStarted
	}
	if e.TeamID != m.homeTeamID && e.TeamID != m.awayTeamID {
		return ErrEventTeamNotInMatch
	}

	switch e.Type {
	case EventYellowCard, EventRedCard:
		if isSentOff(*e.PlayerID, existing) {
			return ErrEventPlayerSentOff
		}
	case EventGoal:
		return m.addGoal(e.TeamID, existing)
	case EventSubstitution, EventInjury:
	}
	return nil
}

func (m *Match) addGoal(teamID uuid.UUID, existing []Event) error {
	score := m.currentScore()
	goals := score.of(teamID, m.homeTeamID)

	if m.status == StatusFinished {
		if countGoals(teamID, existing) >= *goals {
			return ErrEventGoalsComplete
		}
		return nil
	}

	*goals++
	m.score = &score
	return nil
}

func (m *Match) RemoveEvent(id uuid.UUID, existing []Event) (Event, error) {
	if !m.hasEvents() {
		return Event{}, ErrEventMatchNotStarted
	}

	for _, e := range existing {
		if e.ID != id {
			continue
		}
		if e.Type == EventGoal && m.status == StatusLive {
			score := m.currentScore()
			if goals := score.of(e.TeamID, m.homeTeamID); *goals > 0 {
				*goals--
			}
			m.score = &score
		}
		return e, nil
	}
	return Event{}, ErrEventNotFound
}

func (m *Match) CheckGoalEvents(existing []Event) error {
	score := m.currentScore()
	if score.Home < countGoals(m.homeTeamID, existing) || score.Away < countGoals(m.awayTeamID, existing) {
		return ErrScoreBelowGoalEvents
	}
	return nil
}

func (m *Match) currentScore() Score {
	if m.score == nil {
		return Score{}
	}
	return *m.score
}

func (s *Score) of(teamID, homeTeamID uuid.UUID) *int32 {
	if teamID == homeTeamID {
		return &s.Home
	}
	return &s.Away
}

func countGoals(teamID uuid.UUID, events []Event) int32 {
	var n int32
	for _, e := range events {
		if e.Type == EventGoal && e.TeamID == teamID {
			n++
		}
	}
	return n
}

func isSentOff(playerID uuid.UUID, events []Event) bool {
	yellows := 0
	for _, e := range events {
		if e.PlayerID == nil || *e.PlayerID != playerID {
			continue
		}
		switch e.Type {
		case EventRedCard:
			return true
		case EventYellowCard:
			yellows++
		case EventGoal, EventSubstitution, EventInjury:
		}
	}
	return yellows >= 2
}

type EventSummary struct {
	SentOff bool
	Score   *Score
}

func SummarizeEvents(homeTeamID uuid.UUID, events []Event) []EventSummary {
	res := make([]EventSummary, len(events))
	var score Score
	yellows := map[uuid.UUID]int{}

	for i, e := range events {
		switch e.Type {
		case EventGoal:
			*score.of(e.TeamID, homeTeamID)++
			res[i].Score = new(score)
		case EventRedCard:
			res[i].SentOff = true
		case EventYellowCard:
			yellows[*e.PlayerID]++
			res[i].SentOff = yellows[*e.PlayerID] == 2
		case EventSubstitution, EventInjury:
		}
	}
	return res
}

type EventError string

func (e EventError) Error() string { return string(e) }

const (
	ErrEventNotFound                EventError = "event not found"
	ErrEventMatchNotStarted         EventError = "match is not live or finished"
	ErrEventPlayerSentOff           EventError = "player is already sent off"
	ErrEventGoalsComplete           EventError = "team already has as many goal events as goals"
	ErrScoreBelowGoalEvents         EventError = "score is lower than the number of goal events"
	ErrEventInvalidType             EventError = "unknown event type"
	ErrEventInvalidMinute           EventError = "minute must be between 1 and 150"
	ErrEventTeamNotInMatch          EventError = "team does not play this match"
	ErrEventPlayerRequired          EventError = "player is required"
	ErrEventPlayerInRequired        EventError = "player coming in is required"
	ErrEventPlayerInIsPlayer        EventError = "player coming in is the player leaving"
	ErrEventPlayerInNotSubstitution EventError = "only a substitution has a player coming in"
	ErrEventAssistNotGoal           EventError = "only a goal has an assist"
	ErrEventOwnGoalNotGoal          EventError = "only a goal can be an own goal"
	ErrEventPenaltyNotGoal          EventError = "only a goal can be a penalty"
	ErrEventAssistOnSetPiece        EventError = "a penalty or an own goal has no assist"
	ErrEventAssistIsScorer          EventError = "the assist is the scorer"
	ErrEventNoteNotInjury           EventError = "only an injury has a note"
	ErrEventNoteLength              EventError = "note must be 1 to 200 characters"
	ErrEventPlayerNotInSquad        EventError = "player is not in the team's squad on the match day"
	ErrEventAssistNotInSquad        EventError = "assist is not in the team's squad on the match day"
	ErrEventPlayerInNotInSquad      EventError = "player coming in is not in the team's squad on the match day"
)
