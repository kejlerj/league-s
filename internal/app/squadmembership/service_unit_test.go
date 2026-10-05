package squadmembership

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

type leaveCall struct {
	leagueID, seasonID, teamID, playerID uuid.UUID
	leftOn                               time.Time
}

type fakeState struct {
	calls    []string
	current  *Membership
	getErr   error
	rules    SquadRules
	active   int64
	left     leaveCall
	locked   uuid.UUID
	joined   *Membership
	joinRes  *Membership
	rulesErr error
	lockErr  error
	countErr error
	leaveErr error
	joinErr  error
}

type fakeStore struct {
	state  *fakeState
	prefix string
}

func newFakeStore() *fakeStore {
	return &fakeStore{state: &fakeState{rules: seasonRules(nil)}}
}

func (f *fakeStore) record(call string) {
	f.state.calls = append(f.state.calls, f.prefix+call)
}

func (f *fakeStore) Join(_ context.Context, m *Membership) (*Membership, error) {
	f.record("Join")
	if f.state.joinErr != nil {
		return nil, f.state.joinErr
	}
	res := *m
	res.ID = uuid.New()
	f.state.joined = m
	f.state.joinRes = &res
	return &res, nil
}

func (f *fakeStore) Leave(_ context.Context, leagueID, seasonID, teamID, playerID uuid.UUID, leftOn time.Time) (*Membership, error) {
	f.record("Leave")
	if f.state.leaveErr != nil {
		return nil, f.state.leaveErr
	}
	f.state.left = leaveCall{leagueID, seasonID, teamID, playerID, leftOn}
	return &Membership{LeagueID: leagueID, SeasonID: seasonID, TeamID: teamID, PlayerID: playerID, LeftOn: &leftOn}, nil
}

func (f *fakeStore) Get(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID) (*Membership, error) {
	f.record("Get")
	if f.state.getErr != nil {
		return nil, f.state.getErr
	}
	return f.state.current, nil
}

func (f *fakeStore) Rules(context.Context, uuid.UUID, uuid.UUID, uuid.UUID) (*SquadRules, error) {
	f.record("Rules")
	if f.state.rulesErr != nil {
		return nil, f.state.rulesErr
	}
	return &f.state.rules, nil
}

func (f *fakeStore) LockSquad(_ context.Context, _, _, teamID uuid.UUID) (*SquadRules, error) {
	f.record("LockSquad")
	if f.state.lockErr != nil {
		return nil, f.state.lockErr
	}
	f.state.locked = teamID
	return &f.state.rules, nil
}

func (f *fakeStore) CountActive(context.Context, uuid.UUID, uuid.UUID, uuid.UUID) (int64, error) {
	f.record("CountActive")
	return f.state.active, f.state.countErr
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

func newMembership() *Membership {
	return &Membership{
		LeagueID: uuid.New(),
		SeasonID: uuid.New(),
		TeamID:   uuid.New(),
		PlayerID: uuid.New(),
		Number:   new(int32(10)),
		JoinedOn: date(2025, time.October, 15),
	}
}

func newTransfer() Transfer {
	return Transfer{
		LeagueID:   uuid.New(),
		SeasonID:   uuid.New(),
		PlayerID:   uuid.New(),
		FromTeamID: uuid.New(),
		ToTeamID:   uuid.New(),
		Number:     new(int32(9)),
		On:         date(2026, time.January, 15),
	}
}

var errBoom = errors.New("boom")

func TestServiceJoin_LocksCountsThenJoinsInOneTransaction(t *testing.T) {
	store := newFakeStore()
	m := newMembership()

	got, err := NewService(store).Join(t.Context(), m)
	if err != nil {
		t.Fatalf("Join() error = %v", err)
	}

	wantCalls := []string{"begin", "tx.LockSquad", "tx.CountActive", "tx.Join", "commit"}
	if !slices.Equal(store.state.calls, wantCalls) {
		t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
	}
	if store.state.locked != m.TeamID {
		t.Errorf("locked team = %s, want %s", store.state.locked, m.TeamID)
	}
	if store.state.joined != m {
		t.Errorf("Join() called with %+v, want %+v", store.state.joined, m)
	}
	if got != store.state.joinRes {
		t.Errorf("Join() = %+v, want the membership returned by the store", got)
	}
}

func TestServiceJoin_Errors(t *testing.T) {
	beforeJoin := []string{"begin", "tx.LockSquad", "tx.CountActive", "rollback"}

	tests := []struct {
		name      string
		prepare   func(s *fakeState, m *Membership)
		wantErr   error
		wantCalls []string
	}{
		{
			name:      "team not registered",
			prepare:   func(s *fakeState, _ *Membership) { s.lockErr = ErrLockTeamNotRegistered },
			wantErr:   ErrJoinTeamNotRegistered,
			wantCalls: []string{"begin", "tx.LockSquad", "rollback"},
		},
		{
			name:      "lock fails",
			prepare:   func(s *fakeState, _ *Membership) { s.lockErr = errBoom },
			wantErr:   errBoom,
			wantCalls: []string{"begin", "tx.LockSquad", "rollback"},
		},
		{
			name:      "count fails",
			prepare:   func(s *fakeState, _ *Membership) { s.countErr = errBoom },
			wantErr:   errBoom,
			wantCalls: beforeJoin,
		},
		{
			name:      "joining before the season",
			prepare:   func(_ *fakeState, m *Membership) { m.JoinedOn = date(2025, time.July, 31) },
			wantErr:   ErrJoinOutsideSeason,
			wantCalls: beforeJoin,
		},
		{
			name: "squad full",
			prepare: func(s *fakeState, _ *Membership) {
				s.rules.MaxSize = new(int32(10))
				s.active = 10
			},
			wantErr:   ErrJoinSquadFull,
			wantCalls: beforeJoin,
		},
		{
			name:      "store refuses the join",
			prepare:   func(s *fakeState, _ *Membership) { s.joinErr = ErrJoinNumberTaken },
			wantErr:   ErrJoinNumberTaken,
			wantCalls: []string{"begin", "tx.LockSquad", "tx.CountActive", "tx.Join", "rollback"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			m := newMembership()
			tt.prepare(store.state, m)

			got, err := NewService(store).Join(t.Context(), m)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Join() error = %v, want %v", err, tt.wantErr)
			}
			if got != nil {
				t.Errorf("Join() = %+v, want nil", got)
			}
			if !slices.Equal(store.state.calls, tt.wantCalls) {
				t.Errorf("calls = %v, want %v", store.state.calls, tt.wantCalls)
			}
		})
	}
}

func TestServiceLeave_LoadsTheMembershipChecksTheRulesThenLeaves(t *testing.T) {
	store := newFakeStore()
	current := newMembership()
	current.ID = uuid.New()
	store.state.current = current
	want := leaveCall{current.LeagueID, current.SeasonID, current.TeamID, current.PlayerID, date(2025, time.December, 31)}

	got, err := NewService(store).Leave(t.Context(), want.leagueID, want.seasonID, want.teamID, current.ID, want.leftOn)
	if err != nil {
		t.Fatalf("Leave() error = %v", err)
	}

	wantCalls := []string{"Get", "Rules", "Leave"}
	if !slices.Equal(store.state.calls, wantCalls) {
		t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
	}
	if store.state.left != want {
		t.Errorf("Leave() called with %+v, want %+v", store.state.left, want)
	}
	if got == nil || got.LeftOn == nil || !got.LeftOn.Equal(want.leftOn) {
		t.Errorf("Leave() = %+v, want the closed membership", got)
	}
}

func TestServiceLeave_Errors(t *testing.T) {
	tests := []struct {
		name      string
		prepare   func(s *fakeState)
		leftOn    time.Time
		wantErr   error
		wantCalls []string
	}{
		{
			name:      "membership not found",
			prepare:   func(s *fakeState) { s.getErr = ErrGetNotFound },
			leftOn:    date(2025, time.December, 31),
			wantErr:   ErrLeaveNotFound,
			wantCalls: []string{"Get"},
		},
		{
			name:      "already left",
			prepare:   func(s *fakeState) { s.current.LeftOn = new(date(2025, time.November, 30)) },
			leftOn:    date(2025, time.December, 31),
			wantErr:   ErrLeaveNotActive,
			wantCalls: []string{"Get"},
		},
		{
			name:      "team not registered",
			prepare:   func(s *fakeState) { s.rulesErr = ErrRulesTeamNotRegistered },
			leftOn:    date(2025, time.December, 31),
			wantErr:   ErrLeaveTeamNotRegistered,
			wantCalls: []string{"Get", "Rules"},
		},
		{
			name:      "rules fail",
			prepare:   func(s *fakeState) { s.rulesErr = errBoom },
			leftOn:    date(2025, time.December, 31),
			wantErr:   errBoom,
			wantCalls: []string{"Get", "Rules"},
		},
		{
			name:      "leaving after the season",
			prepare:   func(*fakeState) {},
			leftOn:    date(2026, time.June, 1),
			wantErr:   ErrLeaveOutsideSeason,
			wantCalls: []string{"Get", "Rules"},
		},
		{
			name:      "store refuses the leave",
			prepare:   func(s *fakeState) { s.leaveErr = ErrLeaveBeforeJoining },
			leftOn:    date(2025, time.December, 31),
			wantErr:   ErrLeaveBeforeJoining,
			wantCalls: []string{"Get", "Rules", "Leave"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			store.state.current = newMembership()
			tt.prepare(store.state)

			got, err := NewService(store).Leave(t.Context(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), tt.leftOn)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Leave() error = %v, want %v", err, tt.wantErr)
			}
			if got != nil {
				t.Errorf("Leave() = %+v, want nil", got)
			}
			if !slices.Equal(store.state.calls, tt.wantCalls) {
				t.Errorf("calls = %v, want %v", store.state.calls, tt.wantCalls)
			}
		})
	}
}

func TestServiceTransfer_LeavesThenJoinsInOneTransaction(t *testing.T) {
	store := newFakeStore()
	tr := newTransfer()

	got, err := NewService(store).Transfer(t.Context(), tr)
	if err != nil {
		t.Fatalf("Transfer() error = %v", err)
	}

	wantCalls := []string{"begin", "tx.Rules", "tx.Leave", "tx.LockSquad", "tx.CountActive", "tx.Join", "commit"}
	if !slices.Equal(store.state.calls, wantCalls) {
		t.Errorf("calls = %v, want %v", store.state.calls, wantCalls)
	}

	wantLeft := leaveCall{tr.LeagueID, tr.SeasonID, tr.FromTeamID, tr.PlayerID, tr.On}
	if store.state.left != wantLeft {
		t.Errorf("Leave() called with %+v, want %+v", store.state.left, wantLeft)
	}
	if store.state.locked != tr.ToTeamID {
		t.Errorf("locked team = %s, want the destination team %s", store.state.locked, tr.ToTeamID)
	}

	wantJoined := Membership{
		LeagueID: tr.LeagueID,
		SeasonID: tr.SeasonID,
		TeamID:   tr.ToTeamID,
		PlayerID: tr.PlayerID,
		Number:   tr.Number,
		JoinedOn: tr.On,
	}
	if *store.state.joined != wantJoined {
		t.Errorf("Join() called with %+v, want %+v", *store.state.joined, wantJoined)
	}

	if got != store.state.joinRes {
		t.Errorf("Transfer() = %+v, want the membership returned by Join()", got)
	}
}

func TestServiceTransfer_Errors(t *testing.T) {
	tests := []struct {
		name      string
		prepare   func(s *fakeState)
		wantErr   error
		wantCalls []string
	}{
		{
			name:      "leave fails",
			prepare:   func(s *fakeState) { s.leaveErr = ErrLeaveNotActive },
			wantErr:   ErrLeaveNotActive,
			wantCalls: []string{"begin", "tx.Rules", "tx.Leave", "rollback"},
		},
		{
			name: "destination squad full",
			prepare: func(s *fakeState) {
				s.rules.MaxSize = new(int32(10))
				s.active = 10
			},
			wantErr:   ErrJoinSquadFull,
			wantCalls: []string{"begin", "tx.Rules", "tx.Leave", "tx.LockSquad", "tx.CountActive", "rollback"},
		},
		{
			name:      "join fails",
			prepare:   func(s *fakeState) { s.joinErr = ErrJoinNumberTaken },
			wantErr:   ErrJoinNumberTaken,
			wantCalls: []string{"begin", "tx.Rules", "tx.Leave", "tx.LockSquad", "tx.CountActive", "tx.Join", "rollback"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeStore()
			tt.prepare(store.state)

			got, err := NewService(store).Transfer(t.Context(), newTransfer())
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Transfer() error = %v, want %v", err, tt.wantErr)
			}
			if got != nil {
				t.Errorf("Transfer() = %+v, want nil", got)
			}
			if !slices.Equal(store.state.calls, tt.wantCalls) {
				t.Errorf("calls = %v, want %v", store.state.calls, tt.wantCalls)
			}
		})
	}
}
