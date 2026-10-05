package match

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeState struct {
	calls     []string
	season    Season
	current   *Match
	busy      int64
	saved     *Match
	created   *Match
	deleted   uuid.UUID
	lockErr   error
	getErr    error
	countErr  error
	createErr error
}

type fakeStore struct {
	state  *fakeState
	prefix string
}

func newFakeStore() *fakeStore {
	return &fakeStore{state: &fakeState{season: Season{
		StartOn: time.Date(2025, time.August, 1, 0, 0, 0, 0, time.UTC),
		EndOn:   time.Date(2026, time.May, 31, 0, 0, 0, 0, time.UTC),
	}}}
}

func (f *fakeStore) record(call string) {
	f.state.calls = append(f.state.calls, f.prefix+call)
}

func (f *fakeStore) LockSeason(context.Context, uuid.UUID, uuid.UUID) (*Season, error) {
	f.record("LockSeason")
	if f.state.lockErr != nil {
		return nil, f.state.lockErr
	}
	return &f.state.season, nil
}

func (f *fakeStore) CountOnMatchday(context.Context, uuid.UUID, int32, uuid.UUID, ...uuid.UUID) (int64, error) {
	f.record("CountOnMatchday")
	return f.state.busy, f.state.countErr
}

func (f *fakeStore) Create(_ context.Context, m *Match) (*Match, error) {
	f.record("Create")
	if f.state.createErr != nil {
		return nil, f.state.createErr
	}
	f.state.created = m
	return m, nil
}

func (f *fakeStore) GetForUpdate(context.Context, uuid.UUID, uuid.UUID, uuid.UUID) (*Match, error) {
	f.record("GetForUpdate")
	if f.state.getErr != nil {
		return nil, f.state.getErr
	}
	return f.state.current, nil
}

func (f *fakeStore) Save(_ context.Context, _ uuid.UUID, m *Match) (*Match, error) {
	f.record("Save")
	f.state.saved = m
	return m, nil
}

func (f *fakeStore) Delete(_ context.Context, _, _, id uuid.UUID) error {
	f.record("Delete")
	f.state.deleted = id
	return nil
}

func (f *fakeStore) InTx(_ context.Context, fn func(store Store) error) error {
	f.record("begin")
	if err := fn(&fakeStore{state: f.state, prefix: "tx."}); err != nil {
		f.record("rollback")
		return err
	}
	f.record("commit")
	return nil
}

var (
	inSeason      = time.Date(2025, time.October, 4, 18, 0, 0, 0, time.UTC)
	outsideSeason = time.Date(2026, time.June, 1, 18, 0, 0, 0, time.UTC)
	errBoom       = errors.New("boom")
)

func TestServiceSchedule(t *testing.T) {
	store := newFakeStore()
	seasonID, home, away := uuid.New(), uuid.New(), uuid.New()

	got, err := NewService(store).Schedule(t.Context(), uuid.New(), seasonID, home, away, 4, &inSeason)
	if err != nil {
		t.Fatalf("Schedule() error = %v", err)
	}

	wantCalls := []string{"begin", "tx.LockSeason", "tx.CountOnMatchday", "tx.Create", "commit"}
	if !slices.Equal(store.state.calls, wantCalls) {
		t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
	}
	if got.SeasonID() != seasonID || got.HomeTeamID() != home || got.AwayTeamID() != away || got.Matchday() != 4 || got.Status() != StatusScheduled {
		t.Errorf("match = %+v, want it scheduled on matchday 4 between the two teams", got)
	}
}

func TestServiceSchedule_Errors(t *testing.T) {
	home, away := uuid.New(), uuid.New()

	tests := []struct {
		name      string
		prepare   func(s *fakeState)
		away      uuid.UUID
		kickoffAt *time.Time
		wantErr   error
		wantCalls []string
	}{
		{
			name:      "same team twice",
			prepare:   func(*fakeState) {},
			away:      home,
			wantErr:   ErrNewSameTeams,
			wantCalls: nil,
		},
		{
			name:      "season not found",
			prepare:   func(s *fakeState) { s.lockErr = ErrScheduleSeasonNotFound },
			away:      away,
			wantErr:   ErrScheduleSeasonNotFound,
			wantCalls: []string{"begin", "tx.LockSeason", "rollback"},
		},
		{
			name:      "kickoff outside the season",
			prepare:   func(*fakeState) {},
			away:      away,
			kickoffAt: &outsideSeason,
			wantErr:   ErrScheduleKickoffOutsideSeason,
			wantCalls: []string{"begin", "tx.LockSeason", "rollback"},
		},
		{
			name:      "a team already plays that matchday",
			prepare:   func(s *fakeState) { s.busy = 1 },
			away:      away,
			wantErr:   ErrScheduleTeamBusy,
			wantCalls: []string{"begin", "tx.LockSeason", "tx.CountOnMatchday", "rollback"},
		},
		{
			name:      "count fails",
			prepare:   func(s *fakeState) { s.countErr = errBoom },
			away:      away,
			wantErr:   errBoom,
			wantCalls: []string{"begin", "tx.LockSeason", "tx.CountOnMatchday", "rollback"},
		},
		{
			name:      "team not registered",
			prepare:   func(s *fakeState) { s.createErr = ErrScheduleTeamNotRegistered },
			away:      away,
			wantErr:   ErrScheduleTeamNotRegistered,
			wantCalls: []string{"begin", "tx.LockSeason", "tx.CountOnMatchday", "tx.Create", "rollback"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			tt.prepare(store.state)

			got, err := NewService(store).Schedule(t.Context(), uuid.New(), uuid.New(), home, tt.away, 1, tt.kickoffAt)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Schedule() error = %v, want %v", err, tt.wantErr)
			}
			if got != nil {
				t.Errorf("Schedule() = %+v, want nil", got)
			}
			if !slices.Equal(store.state.calls, tt.wantCalls) {
				t.Errorf("calls = %v, want %v", store.state.calls, tt.wantCalls)
			}
		})
	}
}

func TestServiceTransitions_LoadApplySave(t *testing.T) {
	tests := []struct {
		name       string
		from       Status
		apply      func(s *Service, ctx context.Context) (*Match, error)
		wantStatus Status
	}{
		{"Start", StatusScheduled, func(s *Service, ctx context.Context) (*Match, error) {
			return s.Start(ctx, uuid.New(), uuid.New(), uuid.New())
		}, StatusLive},
		{"SetScore", StatusLive, func(s *Service, ctx context.Context) (*Match, error) {
			return s.SetScore(ctx, uuid.New(), uuid.New(), uuid.New(), 2, 1)
		}, StatusLive},
		{"Finish", StatusLive, func(s *Service, ctx context.Context) (*Match, error) {
			return s.Finish(ctx, uuid.New(), uuid.New(), uuid.New())
		}, StatusFinished},
		{"Cancel", StatusScheduled, func(s *Service, ctx context.Context) (*Match, error) {
			return s.Cancel(ctx, uuid.New(), uuid.New(), uuid.New())
		}, StatusCancelled},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			store.state.current = matchIn(tt.from)

			got, err := tt.apply(NewService(store), t.Context())
			if err != nil {
				t.Fatalf("error = %v", err)
			}

			wantCalls := []string{"begin", "tx.GetForUpdate", "tx.Save", "commit"}
			if !slices.Equal(store.state.calls, wantCalls) {
				t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
			}
			if got.Status() != tt.wantStatus || store.state.saved != got {
				t.Errorf("status = %s, want %s saved", got.Status(), tt.wantStatus)
			}
		})
	}
}

func TestServiceTransitions_Errors(t *testing.T) {
	tests := []struct {
		name      string
		prepare   func(s *fakeState)
		wantErr   error
		wantCalls []string
	}{
		{
			name:      "match not found",
			prepare:   func(s *fakeState) { s.getErr = ErrGetNotFound },
			wantErr:   ErrGetNotFound,
			wantCalls: []string{"begin", "tx.GetForUpdate", "rollback"},
		},
		{
			name:      "transition refused by the match",
			prepare:   func(s *fakeState) { s.current = matchIn(StatusCancelled) },
			wantErr:   ErrFinishNotLive,
			wantCalls: []string{"begin", "tx.GetForUpdate", "rollback"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			tt.prepare(store.state)

			got, err := NewService(store).Finish(t.Context(), uuid.New(), uuid.New(), uuid.New())
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Finish() error = %v, want %v", err, tt.wantErr)
			}
			if got != nil || store.state.saved != nil {
				t.Errorf("match = %+v, saved = %+v, want nothing saved", got, store.state.saved)
			}
			if !slices.Equal(store.state.calls, tt.wantCalls) {
				t.Errorf("calls = %v, want %v", store.state.calls, tt.wantCalls)
			}
		})
	}
}

func TestServiceReschedule(t *testing.T) {
	store := newFakeStore()
	store.state.current = matchIn(StatusPostponed)

	got, err := NewService(store).Reschedule(t.Context(), uuid.New(), uuid.New(), uuid.New(), new(int32(5)), &inSeason)
	if err != nil {
		t.Fatalf("Reschedule() error = %v", err)
	}

	wantCalls := []string{"begin", "tx.LockSeason", "tx.GetForUpdate", "tx.CountOnMatchday", "tx.Save", "commit"}
	if !slices.Equal(store.state.calls, wantCalls) {
		t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
	}
	if got.Status() != StatusScheduled || got.Matchday() != 5 || got.KickoffAt() == nil || !got.KickoffAt().Equal(inSeason) {
		t.Errorf("match = %+v, want it scheduled on matchday 5 at the new kickoff", got)
	}
}

func TestServiceReschedule_KeepsWhatIsNotSent(t *testing.T) {
	store := newFakeStore()
	store.state.current = matchIn(StatusScheduled)
	store.state.current.kickoffAt = &inSeason

	got, err := NewService(store).Reschedule(t.Context(), uuid.New(), uuid.New(), uuid.New(), new(int32(7)), nil)
	if err != nil {
		t.Fatalf("Reschedule() error = %v", err)
	}
	if got.Matchday() != 7 || got.KickoffAt() == nil || !got.KickoffAt().Equal(inSeason) {
		t.Errorf("match = %+v, want matchday 7 and the kickoff unchanged", got)
	}
}

func TestServiceReschedule_Errors(t *testing.T) {
	tests := []struct {
		name      string
		prepare   func(s *fakeState)
		kickoffAt *time.Time
		wantErr   error
	}{
		{"match already finished", func(s *fakeState) { s.current = matchIn(StatusFinished) }, &inSeason, ErrRescheduleNotPending},
		{"kickoff outside the season", func(*fakeState) {}, &outsideSeason, ErrScheduleKickoffOutsideSeason},
		{"a team already plays that matchday", func(s *fakeState) { s.busy = 1 }, &inSeason, ErrScheduleTeamBusy},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			store.state.current = matchIn(StatusScheduled)
			tt.prepare(store.state)

			_, err := NewService(store).Reschedule(t.Context(), uuid.New(), uuid.New(), uuid.New(), nil, tt.kickoffAt)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Reschedule() error = %v, want %v", err, tt.wantErr)
			}
			if store.state.saved != nil {
				t.Errorf("saved = %+v, want nothing saved", store.state.saved)
			}
		})
	}
}

func TestServicePostpone(t *testing.T) {
	tests := []struct {
		name       string
		kickoffAt  *time.Time
		wantStatus Status
	}{
		{"without a new date", nil, StatusPostponed},
		{"with a new date", &inSeason, StatusScheduled},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			store.state.current = matchIn(StatusScheduled)

			got, err := NewService(store).Postpone(t.Context(), uuid.New(), uuid.New(), uuid.New(), tt.kickoffAt)
			if err != nil {
				t.Fatalf("Postpone() error = %v", err)
			}
			if got.Status() != tt.wantStatus {
				t.Errorf("status = %s, want %s", got.Status(), tt.wantStatus)
			}
		})
	}
}

func TestServiceDelete(t *testing.T) {
	store := newFakeStore()
	store.state.current = matchIn(StatusScheduled)
	id := uuid.New()

	if err := NewService(store).Delete(t.Context(), uuid.New(), uuid.New(), id); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	wantCalls := []string{"begin", "tx.GetForUpdate", "tx.Delete", "commit"}
	if !slices.Equal(store.state.calls, wantCalls) || store.state.deleted != id {
		t.Errorf("calls = %v, deleted = %s, want %v and %s", store.state.calls, store.state.deleted, wantCalls, id)
	}

	store = newFakeStore()
	store.state.current = matchIn(StatusFinished)
	if err := NewService(store).Delete(t.Context(), uuid.New(), uuid.New(), id); !errors.Is(err, ErrDeleteNotScheduled) {
		t.Errorf("Delete() on a finished match: error = %v, want ErrDeleteNotScheduled", err)
	}
	if store.state.deleted != uuid.Nil {
		t.Error("the match was deleted, want the deletion refused")
	}
}
