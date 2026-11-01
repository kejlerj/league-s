package match

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func (f *fakeStore) ListEvents(context.Context, uuid.UUID, uuid.UUID, uuid.UUID) ([]Event, error) {
	f.record("ListEvents")
	return f.state.events, nil
}

func (f *fakeStore) CreateEvent(_ context.Context, _, _ uuid.UUID, e Event) (Event, error) {
	f.record("CreateEvent")
	e.ID = uuid.New()
	f.state.createdEvent = &e
	return e, nil
}

func (f *fakeStore) DeleteEvent(_ context.Context, _, _, _, id uuid.UUID) error {
	f.record("DeleteEvent")
	f.state.deletedEvent = id
	return nil
}

func (f *fakeStore) IsSquadMember(_ context.Context, _, _, teamID, playerID uuid.UUID, day time.Time) (bool, error) {
	f.record("IsSquadMember")
	f.state.squadDays = append(f.state.squadDays, day)
	return f.state.squad[playerID] == teamID, nil
}

func eventService(store *fakeStore, now time.Time) *Service {
	s := NewService(store)
	s.now = func() time.Time { return now }
	return s
}

func TestServiceRecordEvent_GoalOnALiveMatch(t *testing.T) {
	store := newFakeStore()
	m := matchIn(StatusLive)
	scorer, assist := uuid.New(), uuid.New()
	store.state.current = m
	store.state.squad = map[uuid.UUID]uuid.UUID{scorer: m.HomeTeamID(), assist: m.HomeTeamID()}

	got, err := eventService(store, inSeason).RecordEvent(t.Context(), uuid.New(), m.SeasonID(), m.ID(),
		Event{Type: EventGoal, TeamID: m.HomeTeamID(), Minute: 37, PlayerID: &scorer, AssistPlayerID: &assist})
	if err != nil {
		t.Fatalf("RecordEvent() error = %v", err)
	}

	wantCalls := []string{"begin", "tx.GetForUpdate", "tx.ListEvents", "tx.IsSquadMember", "tx.IsSquadMember", "tx.CreateEvent", "tx.Save", "commit"}
	if !slices.Equal(store.state.calls, wantCalls) {
		t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
	}
	if got.MatchID != m.ID() || got.ID == uuid.Nil {
		t.Errorf("event = %+v, want an event of match %s", got, m.ID())
	}
	if score := *store.state.saved.Score(); score != (Score{Home: 1}) {
		t.Errorf("saved score = %+v, want 1-0", score)
	}
}

func TestServiceRecordEvent_CardIsNotSaved(t *testing.T) {
	store := newFakeStore()
	m := matchIn(StatusLive)
	player := uuid.New()
	store.state.current = m
	store.state.squad = map[uuid.UUID]uuid.UUID{player: m.AwayTeamID()}

	if _, err := eventService(store, inSeason).RecordEvent(t.Context(), uuid.New(), m.SeasonID(), m.ID(),
		Event{Type: EventYellowCard, TeamID: m.AwayTeamID(), Minute: 52, PlayerID: &player}); err != nil {
		t.Fatalf("RecordEvent() error = %v", err)
	}

	wantCalls := []string{"begin", "tx.GetForUpdate", "tx.ListEvents", "tx.IsSquadMember", "tx.CreateEvent", "commit"}
	if !slices.Equal(store.state.calls, wantCalls) {
		t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
	}
}

func TestServiceRecordEvent_MatchDay(t *testing.T) {
	recordedOn := time.Date(2025, time.November, 2, 23, 30, 0, 0, time.FixedZone("UTC+2", 2*3600))
	kickoff := time.Date(2025, time.October, 4, 22, 30, 0, 0, time.FixedZone("UTC-3", -3*3600))

	tests := []struct {
		name    string
		kickoff *time.Time
		want    time.Time
	}{
		{"the UTC date of the kickoff", &kickoff, time.Date(2025, time.October, 5, 0, 0, 0, 0, time.UTC)},
		{"the UTC date of the recording without a kickoff", nil, time.Date(2025, time.November, 2, 0, 0, 0, 0, time.UTC)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			m := matchIn(StatusLive)
			m.kickoffAt = tt.kickoff
			player := uuid.New()
			store.state.current = m
			store.state.squad = map[uuid.UUID]uuid.UUID{player: m.HomeTeamID()}

			if _, err := eventService(store, recordedOn).RecordEvent(t.Context(), uuid.New(), m.SeasonID(), m.ID(),
				Event{Type: EventInjury, TeamID: m.HomeTeamID(), Minute: 10, PlayerID: &player}); err != nil {
				t.Fatalf("RecordEvent() error = %v", err)
			}
			if len(store.state.squadDays) != 1 || !store.state.squadDays[0].Equal(tt.want) {
				t.Errorf("squad checked on %v, want %v", store.state.squadDays, tt.want)
			}
		})
	}
}

func TestServiceRecordEvent_Squads(t *testing.T) {
	m := matchIn(StatusLive)
	home, away := m.HomeTeamID(), m.AwayTeamID()
	homePlayer, homeOther, awayPlayer := uuid.New(), uuid.New(), uuid.New()
	squad := map[uuid.UUID]uuid.UUID{homePlayer: home, homeOther: home, awayPlayer: away}

	tests := []struct {
		name  string
		event Event
		want  error
	}{
		{"scorer of the team", Event{Type: EventGoal, TeamID: home, Minute: 5, PlayerID: &homePlayer}, nil},
		{"scorer of the other team", Event{Type: EventGoal, TeamID: home, Minute: 5, PlayerID: &awayPlayer}, ErrEventPlayerNotInSquad},
		{"own goal by the other team", Event{Type: EventGoal, TeamID: home, Minute: 5, PlayerID: &awayPlayer, OwnGoal: true}, nil},
		{"own goal by the team", Event{Type: EventGoal, TeamID: home, Minute: 5, PlayerID: &homePlayer, OwnGoal: true}, ErrEventPlayerNotInSquad},
		{"assist of the other team", Event{Type: EventGoal, TeamID: home, Minute: 5, PlayerID: &homePlayer, AssistPlayerID: &awayPlayer}, ErrEventAssistNotInSquad},
		{"assist without a scorer", Event{Type: EventGoal, TeamID: home, Minute: 5, AssistPlayerID: &homeOther}, nil},
		{"card of the other team", Event{Type: EventRedCard, TeamID: away, Minute: 5, PlayerID: &homePlayer}, ErrEventPlayerNotInSquad},
		{"substitution", Event{Type: EventSubstitution, TeamID: home, Minute: 5, PlayerID: &homePlayer, PlayerInID: &homeOther}, nil},
		{"player coming in from the other team", Event{Type: EventSubstitution, TeamID: home, Minute: 5, PlayerID: &homePlayer, PlayerInID: &awayPlayer}, ErrEventPlayerInNotInSquad},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			store.state.current = matchIn(StatusLive)
			store.state.current.homeTeamID, store.state.current.awayTeamID = home, away
			store.state.squad = squad

			_, err := eventService(store, inSeason).RecordEvent(t.Context(), uuid.New(), m.SeasonID(), m.ID(), tt.event)
			if !errors.Is(err, tt.want) {
				t.Fatalf("RecordEvent() error = %v, want %v", err, tt.want)
			}
			if tt.want != nil && store.state.createdEvent != nil {
				t.Errorf("a refused event was created")
			}
		})
	}
}

func TestServiceRecordEvent_Errors(t *testing.T) {
	player := uuid.New()

	tests := []struct {
		name      string
		prepare   func(s *fakeState)
		event     func(m *Match) Event
		wantErr   error
		wantCalls []string
	}{
		{
			name:      "an invalid event never opens a transaction",
			event:     func(m *Match) Event { return Event{Type: EventRedCard, TeamID: m.HomeTeamID(), Minute: 5} },
			wantErr:   ErrEventPlayerRequired,
			wantCalls: nil,
		},
		{
			name:      "match not found",
			prepare:   func(s *fakeState) { s.getErr = ErrGetNotFound },
			event:     func(m *Match) Event { return Event{Type: EventGoal, TeamID: m.HomeTeamID(), Minute: 5} },
			wantErr:   ErrGetNotFound,
			wantCalls: []string{"begin", "tx.GetForUpdate", "rollback"},
		},
		{
			name:      "match not started",
			prepare:   func(s *fakeState) { s.current.status = StatusScheduled },
			event:     func(m *Match) Event { return Event{Type: EventGoal, TeamID: m.HomeTeamID(), Minute: 5} },
			wantErr:   ErrEventMatchNotStarted,
			wantCalls: []string{"begin", "tx.GetForUpdate", "tx.ListEvents", "rollback"},
		},
		{
			name: "player already sent off",
			prepare: func(s *fakeState) {
				s.events = []Event{card(s.current.HomeTeamID(), player, EventRedCard)}
			},
			event: func(m *Match) Event {
				return Event{Type: EventYellowCard, TeamID: m.HomeTeamID(), Minute: 80, PlayerID: &player}
			},
			wantErr:   ErrEventPlayerSentOff,
			wantCalls: []string{"begin", "tx.GetForUpdate", "tx.ListEvents", "rollback"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			store.state.current = matchIn(StatusLive)
			store.state.squad = map[uuid.UUID]uuid.UUID{player: store.state.current.HomeTeamID()}
			if tt.prepare != nil {
				tt.prepare(store.state)
			}
			m := store.state.current

			_, err := eventService(store, inSeason).RecordEvent(t.Context(), uuid.New(), m.SeasonID(), m.ID(), tt.event(m))
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("error = %v, want %v", err, tt.wantErr)
			}
			if !slices.Equal(store.state.calls, tt.wantCalls) {
				t.Errorf("calls = %v, want %v", store.state.calls, tt.wantCalls)
			}
		})
	}
}

func TestServiceDeleteEvent(t *testing.T) {
	t.Run("a goal of a live match", func(t *testing.T) {
		store := newFakeStore()
		m := matchIn(StatusLive)
		m.score = &Score{Home: 1}
		g := goal(m.HomeTeamID())
		store.state.current = m
		store.state.events = []Event{g}

		if err := NewService(store).DeleteEvent(t.Context(), uuid.New(), m.SeasonID(), m.ID(), g.ID); err != nil {
			t.Fatalf("DeleteEvent() error = %v", err)
		}

		wantCalls := []string{"begin", "tx.GetForUpdate", "tx.ListEvents", "tx.DeleteEvent", "tx.Save", "commit"}
		if !slices.Equal(store.state.calls, wantCalls) {
			t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
		}
		if store.state.deletedEvent != g.ID {
			t.Errorf("deleted = %s, want %s", store.state.deletedEvent, g.ID)
		}
		if score := *store.state.saved.Score(); score != (Score{}) {
			t.Errorf("saved score = %+v, want 0-0", score)
		}
	})

	t.Run("a card", func(t *testing.T) {
		store := newFakeStore()
		m := matchIn(StatusFinished)
		c := card(m.AwayTeamID(), uuid.New(), EventYellowCard)
		store.state.current = m
		store.state.events = []Event{c}

		if err := NewService(store).DeleteEvent(t.Context(), uuid.New(), m.SeasonID(), m.ID(), c.ID); err != nil {
			t.Fatalf("DeleteEvent() error = %v", err)
		}

		wantCalls := []string{"begin", "tx.GetForUpdate", "tx.ListEvents", "tx.DeleteEvent", "commit"}
		if !slices.Equal(store.state.calls, wantCalls) {
			t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
		}
	})

	t.Run("an unknown event", func(t *testing.T) {
		store := newFakeStore()
		store.state.current = matchIn(StatusLive)

		err := NewService(store).DeleteEvent(t.Context(), uuid.New(), uuid.New(), uuid.New(), uuid.New())
		if !errors.Is(err, ErrEventNotFound) {
			t.Errorf("DeleteEvent() error = %v, want ErrEventNotFound", err)
		}
	})
}

func TestServiceSetScore(t *testing.T) {
	t.Run("saves the score", func(t *testing.T) {
		store := newFakeStore()
		m := matchIn(StatusLive)
		store.state.current = m
		store.state.events = []Event{goal(m.HomeTeamID())}

		got, err := NewService(store).SetScore(t.Context(), uuid.New(), m.SeasonID(), m.ID(), 2, 1)
		if err != nil {
			t.Fatalf("SetScore() error = %v", err)
		}

		wantCalls := []string{"begin", "tx.GetForUpdate", "tx.ListEvents", "tx.Save", "commit"}
		if !slices.Equal(store.state.calls, wantCalls) {
			t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
		}
		if *got.Score() != (Score{Home: 2, Away: 1}) || got.Status() != StatusLive {
			t.Errorf("match = %+v, want live at 2-1", got)
		}
	})

	t.Run("refuses a score below the goal events", func(t *testing.T) {
		store := newFakeStore()
		m := matchIn(StatusLive)
		store.state.current = m
		store.state.events = []Event{goal(m.AwayTeamID()), goal(m.AwayTeamID())}

		_, err := NewService(store).SetScore(t.Context(), uuid.New(), m.SeasonID(), m.ID(), 0, 1)
		if !errors.Is(err, ErrScoreBelowGoalEvents) {
			t.Fatalf("SetScore() error = %v, want ErrScoreBelowGoalEvents", err)
		}
		if store.state.saved != nil {
			t.Error("a refused score was saved")
		}
	})
}
