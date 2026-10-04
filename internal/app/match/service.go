package match

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Store interface {
	LockSeason(ctx context.Context, leagueID, seasonID uuid.UUID) (*Season, error)
	CountOnMatchday(ctx context.Context, seasonID uuid.UUID, matchday int32, excludeID uuid.UUID, teamIDs ...uuid.UUID) (int64, error)
	Create(ctx context.Context, m *Match) (*Match, error)
	GetForUpdate(ctx context.Context, leagueID, seasonID, id uuid.UUID) (*Match, error)
	Save(ctx context.Context, m *Match) (*Match, error)
	Delete(ctx context.Context, id uuid.UUID) error
	InTx(ctx context.Context, fn func(store Store) error) error
}

type Service struct {
	store Store
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) Schedule(ctx context.Context, leagueID, seasonID, homeTeamID, awayTeamID uuid.UUID, matchday int32, kickoffAt *time.Time) (*Match, error) {
	m, err := New(seasonID, homeTeamID, awayTeamID, matchday, kickoffAt)
	if err != nil {
		return nil, err
	}

	var res *Match
	err = s.store.InTx(ctx, func(store Store) error {
		season, err := store.LockSeason(ctx, leagueID, seasonID)
		if err != nil {
			return err
		}
		if err := checkCalendar(ctx, store, season, m); err != nil {
			return err
		}

		res, err = store.Create(ctx, m)
		return err
	})
	return res, err
}

func (s *Service) Reschedule(ctx context.Context, leagueID, seasonID, id uuid.UUID, matchday *int32, kickoffAt *time.Time) (*Match, error) {
	return s.change(ctx, leagueID, seasonID, id, func(m *Match) error {
		newMatchday, newKickoffAt := m.Matchday(), m.KickoffAt()
		if matchday != nil {
			newMatchday = *matchday
		}
		if kickoffAt != nil {
			newKickoffAt = kickoffAt
		}
		return m.Reschedule(newMatchday, newKickoffAt)
	})
}

func (s *Service) Postpone(ctx context.Context, leagueID, seasonID, id uuid.UUID, newKickoffAt *time.Time) (*Match, error) {
	return s.change(ctx, leagueID, seasonID, id, func(m *Match) error {
		if err := m.Postpone(); err != nil {
			return err
		}
		if newKickoffAt == nil {
			return nil
		}
		return m.Reschedule(m.Matchday(), newKickoffAt)
	})
}

func (s *Service) Start(ctx context.Context, leagueID, seasonID, id uuid.UUID) (*Match, error) {
	return s.transition(ctx, leagueID, seasonID, id, (*Match).Start)
}

func (s *Service) SetScore(ctx context.Context, leagueID, seasonID, id uuid.UUID, home, away int32) (*Match, error) {
	return s.transition(ctx, leagueID, seasonID, id, func(m *Match) error {
		return m.SetScore(home, away)
	})
}

func (s *Service) Finish(ctx context.Context, leagueID, seasonID, id uuid.UUID) (*Match, error) {
	return s.transition(ctx, leagueID, seasonID, id, (*Match).Finish)
}

func (s *Service) Cancel(ctx context.Context, leagueID, seasonID, id uuid.UUID) (*Match, error) {
	return s.transition(ctx, leagueID, seasonID, id, (*Match).Cancel)
}

func (s *Service) Delete(ctx context.Context, leagueID, seasonID, id uuid.UUID) error {
	return s.store.InTx(ctx, func(store Store) error {
		m, err := store.GetForUpdate(ctx, leagueID, seasonID, id)
		if err != nil {
			return err
		}
		if err := m.CheckDeletable(); err != nil {
			return err
		}
		return store.Delete(ctx, id)
	})
}

func (s *Service) transition(ctx context.Context, leagueID, seasonID, id uuid.UUID, apply func(m *Match) error) (*Match, error) {
	var res *Match
	err := s.store.InTx(ctx, func(store Store) error {
		m, err := store.GetForUpdate(ctx, leagueID, seasonID, id)
		if err != nil {
			return err
		}
		if err := apply(m); err != nil {
			return err
		}

		res, err = store.Save(ctx, m)
		return err
	})
	return res, err
}

func (s *Service) change(ctx context.Context, leagueID, seasonID, id uuid.UUID, apply func(m *Match) error) (*Match, error) {
	var res *Match
	err := s.store.InTx(ctx, func(store Store) error {
		season, err := store.LockSeason(ctx, leagueID, seasonID)
		if err != nil {
			return err
		}
		m, err := store.GetForUpdate(ctx, leagueID, seasonID, id)
		if err != nil {
			return err
		}
		if err := apply(m); err != nil {
			return err
		}
		if err := checkCalendar(ctx, store, season, m); err != nil {
			return err
		}

		res, err = store.Save(ctx, m)
		return err
	})
	return res, err
}

func checkCalendar(ctx context.Context, store Store, season *Season, m *Match) error {
	if kickoffAt := m.KickoffAt(); kickoffAt != nil && !season.Contains(*kickoffAt) {
		return ErrScheduleKickoffOutsideSeason
	}

	busy, err := store.CountOnMatchday(ctx, m.SeasonID(), m.Matchday(), m.ID(), m.HomeTeamID(), m.AwayTeamID())
	if err != nil {
		return err
	}
	if busy > 0 {
		return ErrScheduleTeamBusy
	}
	return nil
}
