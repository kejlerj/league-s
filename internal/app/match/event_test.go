package match

import (
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func goal(teamID uuid.UUID) Event {
	return Event{ID: uuid.New(), TeamID: teamID, Type: EventGoal, Minute: 10}
}

func card(teamID, playerID uuid.UUID, typ EventType) Event {
	return Event{ID: uuid.New(), TeamID: teamID, Type: typ, Minute: 20, PlayerID: &playerID}
}

func TestEventClean(t *testing.T) {
	team, scorer, other := uuid.New(), uuid.New(), uuid.New()

	tests := []struct {
		name  string
		event Event
		want  error
	}{
		{"goal without a scorer", Event{Type: EventGoal, Minute: 1}, nil},
		{"goal with a scorer and an assist", Event{Type: EventGoal, Minute: 150, PlayerID: &scorer, AssistPlayerID: &other}, nil},
		{"penalty", Event{Type: EventGoal, Minute: 30, PlayerID: &scorer, Penalty: true}, nil},
		{"own goal", Event{Type: EventGoal, Minute: 30, PlayerID: &scorer, OwnGoal: true}, nil},
		{"minute 0", Event{Type: EventGoal, Minute: 0}, ErrEventInvalidMinute},
		{"minute 151", Event{Type: EventGoal, Minute: 151}, ErrEventInvalidMinute},
		{"assist on a penalty", Event{Type: EventGoal, Minute: 30, PlayerID: &scorer, AssistPlayerID: &other, Penalty: true}, ErrEventAssistOnSetPiece},
		{"assist on an own goal", Event{Type: EventGoal, Minute: 30, AssistPlayerID: &other, OwnGoal: true}, ErrEventAssistOnSetPiece},
		{"assist is the scorer", Event{Type: EventGoal, Minute: 30, PlayerID: &scorer, AssistPlayerID: &scorer}, ErrEventAssistIsScorer},
		{"yellow card", Event{Type: EventYellowCard, Minute: 30, PlayerID: &scorer}, nil},
		{"red card without a player", Event{Type: EventRedCard, Minute: 30}, ErrEventPlayerRequired},
		{"injury without a player", Event{Type: EventInjury, Minute: 30}, ErrEventPlayerRequired},
		{"card with an assist", Event{Type: EventYellowCard, Minute: 30, PlayerID: &scorer, AssistPlayerID: &other}, ErrEventAssistNotGoal},
		{"card marked as an own goal", Event{Type: EventYellowCard, Minute: 30, PlayerID: &scorer, OwnGoal: true}, ErrEventOwnGoalNotGoal},
		{"card marked as a penalty", Event{Type: EventRedCard, Minute: 30, PlayerID: &scorer, Penalty: true}, ErrEventPenaltyNotGoal},
		{"substitution", Event{Type: EventSubstitution, Minute: 60, PlayerID: &scorer, PlayerInID: &other}, nil},
		{"substitution without the player leaving", Event{Type: EventSubstitution, Minute: 60, PlayerInID: &other}, ErrEventPlayerRequired},
		{"substitution without the player coming in", Event{Type: EventSubstitution, Minute: 60, PlayerID: &scorer}, ErrEventPlayerInRequired},
		{"substitution of a player by himself", Event{Type: EventSubstitution, Minute: 60, PlayerID: &scorer, PlayerInID: &scorer}, ErrEventPlayerInIsPlayer},
		{"player coming in on a goal", Event{Type: EventGoal, Minute: 60, PlayerID: &scorer, PlayerInID: &other}, ErrEventPlayerInNotSubstitution},
		{"injury with a note", Event{Type: EventInjury, Minute: 71, PlayerID: &scorer, Note: new("Cheville")}, nil},
		{"injury with a blank note", Event{Type: EventInjury, Minute: 71, PlayerID: &scorer, Note: new("   ")}, ErrEventNoteLength},
		{"injury with a long note", Event{Type: EventInjury, Minute: 71, PlayerID: &scorer, Note: new(strings.Repeat("é", 201))}, ErrEventNoteLength},
		{"note on a card", Event{Type: EventYellowCard, Minute: 71, PlayerID: &scorer, Note: new("Cheville")}, ErrEventNoteNotInjury},
		{"unknown type", Event{Type: "corner", Minute: 71}, ErrEventInvalidType},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.event.TeamID = team
			if _, err := tt.event.Clean(); !errors.Is(err, tt.want) {
				t.Errorf("Clean() error = %v, want %v", err, tt.want)
			}
		})
	}

	t.Run("trims the note", func(t *testing.T) {
		got, err := Event{Type: EventInjury, Minute: 71, PlayerID: &scorer, Note: new("  Cheville ")}.Clean()
		if err != nil {
			t.Fatalf("Clean() error = %v", err)
		}
		if got.Note == nil || *got.Note != "Cheville" {
			t.Errorf("note = %v, want Cheville", got.Note)
		}
	})
	t.Run("a 200 character note is accepted", func(t *testing.T) {
		if _, err := (Event{Type: EventInjury, Minute: 71, PlayerID: &scorer, Note: new(strings.Repeat("é", 200))}).Clean(); err != nil {
			t.Errorf("Clean() error = %v", err)
		}
	})
}

func TestEventSquadTeam(t *testing.T) {
	m := matchIn(StatusLive)

	if got := goal(m.HomeTeamID()).SquadTeamID(m); got != m.HomeTeamID() {
		t.Errorf("goal: squad team = %s, want the home team", got)
	}
	ownGoal := goal(m.HomeTeamID())
	ownGoal.OwnGoal = true
	if got := ownGoal.SquadTeamID(m); got != m.AwayTeamID() {
		t.Errorf("own goal: squad team = %s, want the away team", got)
	}
}

func TestRecordEvent_Status(t *testing.T) {
	for _, status := range allStatuses {
		t.Run(string(status), func(t *testing.T) {
			m := matchIn(status)
			err := m.RecordEvent(card(m.HomeTeamID(), uuid.New(), EventYellowCard), nil)

			allowed := status == StatusLive || status == StatusFinished
			if allowed && err != nil {
				t.Errorf("RecordEvent() error = %v, want nil", err)
			}
			if !allowed && !errors.Is(err, ErrEventMatchNotStarted) {
				t.Errorf("RecordEvent() error = %v, want ErrEventMatchNotStarted", err)
			}
		})
	}
}

func TestRecordEvent_TeamOfTheMatch(t *testing.T) {
	m := matchIn(StatusLive)

	if err := m.RecordEvent(goal(uuid.New()), nil); !errors.Is(err, ErrEventTeamNotInMatch) {
		t.Errorf("RecordEvent() error = %v, want ErrEventTeamNotInMatch", err)
	}
}

func TestRecordEvent_GoalOnALiveMatchChangesTheScore(t *testing.T) {
	m := matchIn(StatusLive)

	if err := m.RecordEvent(goal(m.AwayTeamID()), nil); err != nil {
		t.Fatalf("RecordEvent() error = %v", err)
	}
	if err := m.RecordEvent(goal(m.HomeTeamID()), nil); err != nil {
		t.Fatalf("RecordEvent() error = %v", err)
	}
	if err := m.RecordEvent(goal(m.AwayTeamID()), nil); err != nil {
		t.Fatalf("RecordEvent() error = %v", err)
	}

	if got := *m.Score(); got != (Score{Home: 1, Away: 2}) {
		t.Errorf("score = %+v, want 1-2", got)
	}
}

func TestRecordEvent_CardsDontChangeTheScore(t *testing.T) {
	m := matchIn(StatusLive)

	if err := m.RecordEvent(card(m.HomeTeamID(), uuid.New(), EventRedCard), nil); err != nil {
		t.Fatalf("RecordEvent() error = %v", err)
	}
	if got := *m.Score(); got != (Score{}) {
		t.Errorf("score = %+v, want 0-0", got)
	}
}

func TestRecordEvent_GoalOnAFinishedMatch(t *testing.T) {
	m := matchIn(StatusFinished)
	m.score = &Score{Home: 2, Away: 0}
	first := goal(m.HomeTeamID())

	if err := m.RecordEvent(first, nil); err != nil {
		t.Fatalf("first goal: error = %v", err)
	}
	if err := m.RecordEvent(goal(m.HomeTeamID()), []Event{first}); err != nil {
		t.Fatalf("second goal: error = %v", err)
	}
	if got := *m.Score(); got != (Score{Home: 2, Away: 0}) {
		t.Errorf("score = %+v, want 2-0 unchanged", got)
	}

	if err := m.RecordEvent(goal(m.HomeTeamID()), []Event{first, goal(m.HomeTeamID())}); !errors.Is(err, ErrEventGoalsComplete) {
		t.Errorf("third goal: error = %v, want ErrEventGoalsComplete", err)
	}
	if err := m.RecordEvent(goal(m.AwayTeamID()), []Event{first}); !errors.Is(err, ErrEventGoalsComplete) {
		t.Errorf("away goal at 2-0: error = %v, want ErrEventGoalsComplete", err)
	}
}

func TestRecordEvent_SendingOff(t *testing.T) {
	m := matchIn(StatusLive)
	team, player := m.HomeTeamID(), uuid.New()
	yellow := card(team, player, EventYellowCard)
	red := card(team, player, EventRedCard)
	other := card(team, uuid.New(), EventRedCard)

	tests := []struct {
		name     string
		existing []Event
		event    Event
		want     error
	}{
		{"first yellow", nil, yellow, nil},
		{"second yellow", []Event{yellow}, card(team, player, EventYellowCard), nil},
		{"third yellow", []Event{yellow, card(team, player, EventYellowCard)}, card(team, player, EventYellowCard), ErrEventPlayerSentOff},
		{"red after a second yellow", []Event{yellow, card(team, player, EventYellowCard)}, red, ErrEventPlayerSentOff},
		{"red after one yellow", []Event{yellow}, red, nil},
		{"yellow after a red", []Event{red}, yellow, ErrEventPlayerSentOff},
		{"second red", []Event{red}, card(team, player, EventRedCard), ErrEventPlayerSentOff},
		{"another player was sent off", []Event{other}, yellow, nil},
		{"a sent off player can still be injured", []Event{red}, card(team, player, EventInjury), nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := m.RecordEvent(tt.event, tt.existing); !errors.Is(err, tt.want) {
				t.Errorf("RecordEvent() error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestRemoveEvent(t *testing.T) {
	t.Run("a goal of a live match is taken off the score", func(t *testing.T) {
		m := matchIn(StatusLive)
		m.score = &Score{Home: 1, Away: 1}
		home, away := goal(m.HomeTeamID()), goal(m.AwayTeamID())

		got, err := m.RemoveEvent(away.ID, []Event{home, away})
		if err != nil {
			t.Fatalf("RemoveEvent() error = %v", err)
		}
		if got.ID != away.ID {
			t.Errorf("removed = %s, want %s", got.ID, away.ID)
		}
		if score := *m.Score(); score != (Score{Home: 1, Away: 0}) {
			t.Errorf("score = %+v, want 1-0", score)
		}
	})

	t.Run("a goal of a finished match leaves the score", func(t *testing.T) {
		m := matchIn(StatusFinished)
		m.score = &Score{Home: 3, Away: 0}
		home := goal(m.HomeTeamID())

		if _, err := m.RemoveEvent(home.ID, []Event{home}); err != nil {
			t.Fatalf("RemoveEvent() error = %v", err)
		}
		if score := *m.Score(); score != (Score{Home: 3, Away: 0}) {
			t.Errorf("score = %+v, want 3-0", score)
		}
	})

	t.Run("an unknown event", func(t *testing.T) {
		m := matchIn(StatusLive)
		if _, err := m.RemoveEvent(uuid.New(), []Event{goal(m.HomeTeamID())}); !errors.Is(err, ErrEventNotFound) {
			t.Errorf("RemoveEvent() error = %v, want ErrEventNotFound", err)
		}
	})

	for _, status := range []Status{StatusScheduled, StatusPostponed, StatusCancelled} {
		t.Run(string(status)+" match", func(t *testing.T) {
			m := matchIn(status)
			e := goal(m.HomeTeamID())
			if _, err := m.RemoveEvent(e.ID, []Event{e}); !errors.Is(err, ErrEventMatchNotStarted) {
				t.Errorf("RemoveEvent() error = %v, want ErrEventMatchNotStarted", err)
			}
		})
	}
}

func TestCheckGoalEvents(t *testing.T) {
	m := matchIn(StatusLive)
	events := []Event{goal(m.HomeTeamID()), goal(m.HomeTeamID()), goal(m.AwayTeamID()), card(m.AwayTeamID(), uuid.New(), EventYellowCard)}

	tests := []struct {
		score Score
		want  error
	}{
		{Score{Home: 2, Away: 1}, nil},
		{Score{Home: 3, Away: 4}, nil},
		{Score{Home: 1, Away: 1}, ErrScoreBelowGoalEvents},
		{Score{Home: 2, Away: 0}, ErrScoreBelowGoalEvents},
	}
	for _, tt := range tests {
		m.score = &tt.score
		if err := m.CheckGoalEvents(events); !errors.Is(err, tt.want) {
			t.Errorf("score %+v: error = %v, want %v", tt.score, err, tt.want)
		}
	}
}

func TestSummarizeEvents(t *testing.T) {
	m := matchIn(StatusLive)
	home, away := m.HomeTeamID(), m.AwayTeamID()
	player, other := uuid.New(), uuid.New()
	ownGoal := goal(home)
	ownGoal.OwnGoal = true

	events := []Event{
		goal(home),
		card(away, player, EventYellowCard),
		goal(away),
		card(away, player, EventYellowCard),
		card(home, other, EventRedCard),
		{ID: uuid.New(), TeamID: home, Type: EventSubstitution, Minute: 60, PlayerID: new(uuid.New()), PlayerInID: new(uuid.New())},
		ownGoal,
	}

	got := SummarizeEvents(home, events)

	want := []EventSummary{
		{Score: &Score{Home: 1, Away: 0}},
		{},
		{Score: &Score{Home: 1, Away: 1}},
		{SentOff: true},
		{SentOff: true},
		{},
		{Score: &Score{Home: 2, Away: 1}},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d summaries, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i].SentOff != want[i].SentOff {
			t.Errorf("event %d: sent off = %v, want %v", i, got[i].SentOff, want[i].SentOff)
		}
		if (got[i].Score == nil) != (want[i].Score == nil) || (got[i].Score != nil && *got[i].Score != *want[i].Score) {
			t.Errorf("event %d: score = %v, want %v", i, got[i].Score, want[i].Score)
		}
	}
}
