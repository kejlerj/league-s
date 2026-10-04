//go:build integration

package squadmembership

import (
	"errors"
	"slices"
	"sync"
	"testing"

	"github.com/google/uuid"

	"league-s/internal/db"
	"league-s/internal/testdb"
)

func TestService_Transfer(t *testing.T) {
	f := newFixture(t)
	svc := NewService(f.store)
	f.join(t, f.home, f.player, new(int32(10)), "2025-08-01")

	m, err := svc.Transfer(t.Context(), Transfer{
		LeagueID:   f.season.LeagueID,
		SeasonID:   f.season.ID,
		PlayerID:   f.player.ID,
		FromTeamID: f.home.ID,
		ToTeamID:   f.away.ID,
		Number:     new(int32(9)),
		On:         day(t, "2026-01-15"),
	})
	if err != nil {
		t.Fatalf("Transfer() error = %v", err)
	}
	if m.TeamID != f.away.ID {
		t.Errorf("new membership team = %s, want %s", m.TeamID, f.away.ID)
	}
}

func TestService_FailedTransferIsRolledBack(t *testing.T) {
	f := newFixture(t)
	svc := NewService(f.store)
	f.join(t, f.home, f.player, new(int32(10)), "2025-08-01")

	_, err := svc.Transfer(t.Context(), Transfer{
		LeagueID:   f.season.LeagueID,
		SeasonID:   f.season.ID,
		PlayerID:   f.player.ID,
		FromTeamID: f.home.ID,
		ToTeamID:   f.unregistered.ID,
		On:         day(t, "2026-01-15"),
	})
	if !errors.Is(err, ErrJoinTeamNotRegistered) {
		t.Fatalf("Transfer() error = %v, want ErrJoinTeamNotRegistered", err)
	}

	active, err := f.store.Active(t.Context(), f.season.LeagueID, f.season.ID, f.player.ID)
	if err != nil {
		t.Fatalf("Active() error = %v, want the player still in the first team", err)
	}
	if active.TeamID != f.home.ID {
		t.Errorf("active team = %s, want %s: the leave must be rolled back", active.TeamID, f.home.ID)
	}
}

func (f fixture) setMaxSquadSize(t *testing.T, n int32) {
	t.Helper()
	if _, err := testPool.Exec(t.Context(), `UPDATE season SET max_squad_size = $1 WHERE id = $2`, n, f.season.ID); err != nil {
		t.Fatalf("set max squad size: %v", err)
	}
}

func TestService_Join(t *testing.T) {
	f := newFixture(t)
	f.setMaxSquadSize(t, 1)

	m, err := NewService(f.store).Join(t.Context(), f.membership(t, f.home, f.player, new(int32(10)), "2025-08-01"))
	if err != nil {
		t.Fatalf("Join() error = %v", err)
	}
	if m.TeamID != f.home.ID || m.PlayerID != f.player.ID {
		t.Errorf("membership = %+v, want the player in the home team", m)
	}
}

func TestService_Join_Errors(t *testing.T) {
	tests := []struct {
		name    string
		prepare func(f fixture) *Membership
		wantErr JoinError
	}{
		{
			name: "team not registered",
			prepare: func(f fixture) *Membership {
				return f.membership(t, f.unregistered, f.player, nil, "2025-08-01")
			},
			wantErr: ErrJoinTeamNotRegistered,
		},
		{
			name: "joining before the season",
			prepare: func(f fixture) *Membership {
				return f.membership(t, f.home, f.player, nil, "2025-07-31")
			},
			wantErr: ErrJoinOutsideSeason,
		},
		{
			name: "joining after the season",
			prepare: func(f fixture) *Membership {
				return f.membership(t, f.home, f.player, nil, "2026-06-01")
			},
			wantErr: ErrJoinOutsideSeason,
		},
		{
			name: "squad full",
			prepare: func(f fixture) *Membership {
				f.setMaxSquadSize(t, 1)
				f.join(t, f.home, f.seed.CreatePlayer(testdb.PlayerParams{}), nil, "2025-08-01")
				return f.membership(t, f.home, f.player, nil, "2025-08-01")
			},
			wantErr: ErrJoinSquadFull,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newFixture(t)
			m := tt.prepare(f)

			if _, err := NewService(f.store).Join(t.Context(), m); !errors.Is(err, tt.wantErr) {
				t.Fatalf("Join() error = %v, want %v", err, tt.wantErr)
			}
			if members := f.list(t, f.home, false); slices.ContainsFunc(members, func(m *Member) bool { return m.ID == f.player.ID }) {
				t.Error("the player is in the squad, want the join refused")
			}
		})
	}
}

func TestService_Join_APlaceIsFreedWhenAPlayerLeaves(t *testing.T) {
	f := newFixture(t)
	f.setMaxSquadSize(t, 1)
	svc := NewService(f.store)
	other := f.seed.CreatePlayer(testdb.PlayerParams{})
	m := f.join(t, f.home, other, nil, "2025-08-01")

	if _, err := svc.Leave(t.Context(), f.season.LeagueID, f.season.ID, f.home.ID, m.ID, day(t, "2025-12-31")); err != nil {
		t.Fatalf("Leave() error = %v", err)
	}
	if _, err := svc.Join(t.Context(), f.membership(t, f.home, f.player, nil, "2026-01-01")); err != nil {
		t.Errorf("Join() error = %v, want the freed place to be available", err)
	}
}

func TestService_Join_ConcurrentJoinsRespectMaxSize(t *testing.T) {
	const maxSize, candidates = 2, 6

	f := newFixture(t)
	f.setMaxSquadSize(t, maxSize)
	svc := NewService(f.store)

	memberships := make([]*Membership, candidates)
	for i := range memberships {
		memberships[i] = f.membership(t, f.home, f.seed.CreatePlayer(testdb.PlayerParams{}), nil, "2025-08-01")
	}

	errs := make([]error, candidates)
	var wg sync.WaitGroup
	for i, m := range memberships {
		wg.Go(func() {
			_, errs[i] = svc.Join(t.Context(), m)
		})
	}
	wg.Wait()

	joined := 0
	for _, err := range errs {
		switch {
		case err == nil:
			joined++
		case !errors.Is(err, ErrJoinSquadFull):
			t.Errorf("Join() error = %v, want nil or ErrJoinSquadFull", err)
		}
	}
	if joined != maxSize {
		t.Errorf("%d players joined, want %d", joined, maxSize)
	}
	if members := f.list(t, f.home, false); len(members) != maxSize {
		t.Errorf("active squad has %d members, want %d", len(members), maxSize)
	}
}

func TestService_Leave(t *testing.T) {
	f := newFixture(t)
	joined := f.join(t, f.home, f.player, nil, "2025-08-01")

	m, err := NewService(f.store).Leave(t.Context(), f.season.LeagueID, f.season.ID, f.home.ID, joined.ID, day(t, "2026-05-31"))
	if err != nil {
		t.Fatalf("Leave() error = %v", err)
	}
	if m.LeftOn == nil || !m.LeftOn.Equal(day(t, "2026-05-31")) {
		t.Errorf("left_on = %v, want 2026-05-31", m.LeftOn)
	}
}

func TestService_Leave_Errors(t *testing.T) {
	tests := []struct {
		name    string
		team    func(f fixture) db.Team
		id      func(m *Membership) uuid.UUID
		leftOn  string
		wantErr LeaveError
	}{
		{
			name:    "unknown membership",
			team:    func(f fixture) db.Team { return f.home },
			id:      func(*Membership) uuid.UUID { return uuid.New() },
			leftOn:  "2025-12-31",
			wantErr: ErrLeaveNotFound,
		},
		{
			name:    "membership of another squad",
			team:    func(f fixture) db.Team { return f.away },
			id:      func(m *Membership) uuid.UUID { return m.ID },
			leftOn:  "2025-12-31",
			wantErr: ErrLeaveNotFound,
		},
		{
			name:    "leaving after the season",
			team:    func(f fixture) db.Team { return f.home },
			id:      func(m *Membership) uuid.UUID { return m.ID },
			leftOn:  "2026-06-01",
			wantErr: ErrLeaveOutsideSeason,
		},
		{
			name:    "leaving before joining",
			team:    func(f fixture) db.Team { return f.home },
			id:      func(m *Membership) uuid.UUID { return m.ID },
			leftOn:  "2025-08-31",
			wantErr: ErrLeaveBeforeJoining,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newFixture(t)
			m := f.join(t, f.home, f.player, nil, "2025-09-01")

			_, err := NewService(f.store).Leave(t.Context(), f.season.LeagueID, f.season.ID, tt.team(f).ID, tt.id(m), day(t, tt.leftOn))
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Leave() error = %v, want %v", err, tt.wantErr)
			}
			if members := f.list(t, f.home, false); len(members) != 1 {
				t.Errorf("active squad has %d members, want the player still in it", len(members))
			}
		})
	}
}

func TestService_Leave_AlreadyLeftDoesNotCloseALaterStint(t *testing.T) {
	f := newFixture(t)
	svc := NewService(f.store)
	first := f.join(t, f.home, f.player, nil, "2025-08-01")
	if _, err := svc.Leave(t.Context(), f.season.LeagueID, f.season.ID, f.home.ID, first.ID, day(t, "2025-10-31")); err != nil {
		t.Fatalf("first Leave() error = %v", err)
	}
	f.join(t, f.home, f.player, nil, "2026-02-01")

	_, err := svc.Leave(t.Context(), f.season.LeagueID, f.season.ID, f.home.ID, first.ID, day(t, "2026-03-01"))
	if !errors.Is(err, ErrLeaveNotActive) {
		t.Fatalf("Leave() on a closed stint: error = %v, want ErrLeaveNotActive", err)
	}
	if members := f.list(t, f.home, false); len(members) != 1 {
		t.Errorf("active squad has %d members, want the second stint still active", len(members))
	}
}

func TestService_TransferToAFullSquadIsRolledBack(t *testing.T) {
	f := newFixture(t)
	f.setMaxSquadSize(t, 1)
	f.join(t, f.home, f.player, nil, "2025-08-01")
	f.join(t, f.away, f.seed.CreatePlayer(testdb.PlayerParams{}), nil, "2025-08-01")

	_, err := NewService(f.store).Transfer(t.Context(), Transfer{
		LeagueID:   f.season.LeagueID,
		SeasonID:   f.season.ID,
		PlayerID:   f.player.ID,
		FromTeamID: f.home.ID,
		ToTeamID:   f.away.ID,
		On:         day(t, "2026-01-15"),
	})
	if !errors.Is(err, ErrJoinSquadFull) {
		t.Fatalf("Transfer() error = %v, want ErrJoinSquadFull", err)
	}

	active, err := f.store.Active(t.Context(), f.season.LeagueID, f.season.ID, f.player.ID)
	if err != nil {
		t.Fatalf("Active() error = %v, want the player still in the first team", err)
	}
	if active.TeamID != f.home.ID {
		t.Errorf("active team = %s, want %s: the leave must be rolled back", active.TeamID, f.home.ID)
	}
}
