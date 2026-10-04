package squadmembership

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Store interface {
	Join(ctx context.Context, m *Membership) (*Membership, error)
	Get(ctx context.Context, leagueID, seasonID, teamID, id uuid.UUID) (*Membership, error)
	Leave(ctx context.Context, leagueID, seasonID, teamID, playerID uuid.UUID, leftOn time.Time) (*Membership, error)
	Rules(ctx context.Context, leagueID, seasonID, teamID uuid.UUID) (*SquadRules, error)
	LockSquad(ctx context.Context, leagueID, seasonID, teamID uuid.UUID) (*SquadRules, error)
	CountActive(ctx context.Context, leagueID, seasonID, teamID uuid.UUID) (int64, error)
	InTx(ctx context.Context, fn func(store Store) error) error
}

type Service struct {
	store Store
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) Join(ctx context.Context, m *Membership) (*Membership, error) {
	var res *Membership
	err := s.store.InTx(ctx, func(store Store) error {
		var err error
		res, err = join(ctx, store, m)
		return err
	})
	return res, err
}

func (s *Service) Leave(ctx context.Context, leagueID, seasonID, teamID, membershipID uuid.UUID, on time.Time) (*Membership, error) {
	m, err := s.store.Get(ctx, leagueID, seasonID, teamID, membershipID)
	if errors.Is(err, ErrGetNotFound) {
		return nil, ErrLeaveNotFound
	}
	if err != nil {
		return nil, err
	}
	if m.LeftOn != nil {
		return nil, ErrLeaveNotActive
	}

	return leave(ctx, s.store, leagueID, seasonID, teamID, m.PlayerID, on)
}

func (s *Service) Transfer(ctx context.Context, t Transfer) (*Membership, error) {
	var res *Membership
	err := s.store.InTx(ctx, func(store Store) error {
		if _, err := leave(ctx, store, t.LeagueID, t.SeasonID, t.FromTeamID, t.PlayerID, t.On); err != nil {
			return err
		}

		var err error
		res, err = join(ctx, store, &Membership{
			LeagueID: t.LeagueID,
			SeasonID: t.SeasonID,
			TeamID:   t.ToTeamID,
			PlayerID: t.PlayerID,
			Number:   t.Number,
			JoinedOn: t.On,
		})
		return err
	})
	return res, err
}

func join(ctx context.Context, store Store, m *Membership) (*Membership, error) {
	rules, err := store.LockSquad(ctx, m.LeagueID, m.SeasonID, m.TeamID)
	if errors.Is(err, ErrLockTeamNotRegistered) {
		return nil, ErrJoinTeamNotRegistered
	}
	if err != nil {
		return nil, err
	}

	active, err := store.CountActive(ctx, m.LeagueID, m.SeasonID, m.TeamID)
	if err != nil {
		return nil, err
	}

	if err := rules.CheckJoin(m.JoinedOn, active); err != nil {
		return nil, err
	}

	return store.Join(ctx, m)
}

func leave(ctx context.Context, store Store, leagueID, seasonID, teamID, playerID uuid.UUID, on time.Time) (*Membership, error) {
	rules, err := store.Rules(ctx, leagueID, seasonID, teamID)
	if errors.Is(err, ErrRulesTeamNotRegistered) {
		return nil, ErrLeaveTeamNotRegistered
	}
	if err != nil {
		return nil, err
	}

	if err := rules.CheckLeave(on); err != nil {
		return nil, err
	}

	return store.Leave(ctx, leagueID, seasonID, teamID, playerID, on)
}
