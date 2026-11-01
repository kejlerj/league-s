package match

import (
	"context"
	"time"

	"github.com/google/uuid"
)

func (s *Service) RecordEvent(ctx context.Context, leagueID, seasonID, matchID uuid.UUID, e Event) (Event, error) {
	e, err := e.Clean()
	if err != nil {
		return Event{}, err
	}
	e.MatchID = matchID

	var res Event
	err = s.store.InTx(ctx, func(store Store) error {
		m, err := store.GetForUpdate(ctx, leagueID, seasonID, matchID)
		if err != nil {
			return err
		}
		existing, err := store.ListEvents(ctx, leagueID, seasonID, matchID)
		if err != nil {
			return err
		}
		if err := m.RecordEvent(e, existing); err != nil {
			return err
		}
		if err := checkSquads(ctx, store, leagueID, seasonID, m, e, s.matchDay(m)); err != nil {
			return err
		}

		res, err = store.CreateEvent(ctx, leagueID, seasonID, e)
		if err != nil {
			return err
		}
		if e.Type == EventGoal {
			_, err = store.Save(ctx, leagueID, m)
		}
		return err
	})
	return res, err
}

func (s *Service) DeleteEvent(ctx context.Context, leagueID, seasonID, matchID, id uuid.UUID) error {
	return s.store.InTx(ctx, func(store Store) error {
		m, err := store.GetForUpdate(ctx, leagueID, seasonID, matchID)
		if err != nil {
			return err
		}
		existing, err := store.ListEvents(ctx, leagueID, seasonID, matchID)
		if err != nil {
			return err
		}
		removed, err := m.RemoveEvent(id, existing)
		if err != nil {
			return err
		}

		if err := store.DeleteEvent(ctx, leagueID, seasonID, matchID, id); err != nil {
			return err
		}
		if removed.Type == EventGoal {
			_, err = store.Save(ctx, leagueID, m)
		}
		return err
	})
}

func (s *Service) matchDay(m *Match) time.Time {
	day := s.now()
	if kickoffAt := m.KickoffAt(); kickoffAt != nil {
		day = *kickoffAt
	}
	day = day.UTC()
	return time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC)
}

func checkSquads(ctx context.Context, store Store, leagueID, seasonID uuid.UUID, m *Match, e Event, day time.Time) error {
	checks := []struct {
		teamID   uuid.UUID
		playerID *uuid.UUID
		err      error
	}{
		{e.SquadTeamID(m), e.PlayerID, ErrEventPlayerNotInSquad},
		{e.SquadTeamID(m), e.AssistPlayerID, ErrEventAssistNotInSquad},
		{e.TeamID, e.PlayerInID, ErrEventPlayerInNotInSquad},
	}

	for _, c := range checks {
		if c.playerID == nil {
			continue
		}
		member, err := store.IsSquadMember(ctx, leagueID, seasonID, c.teamID, *c.playerID, day)
		if err != nil {
			return err
		}
		if !member {
			return c.err
		}
	}
	return nil
}
