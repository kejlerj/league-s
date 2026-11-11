package match

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"league-s/internal/db"
)

type PlayerName struct {
	ID        uuid.UUID
	Firstname string
	Lastname  string
}

type EventView struct {
	Event
	Player       *PlayerName
	AssistPlayer *PlayerName
	PlayerIn     *PlayerName
}

func toPgUUID(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *id, Valid: true}
}

func fromPgUUID(id pgtype.UUID) *uuid.UUID {
	if !id.Valid {
		return nil
	}
	return new(uuid.UUID(id.Bytes))
}

func toEvent(e db.MatchEvent) Event {
	return Event{
		ID:             e.ID,
		MatchID:        e.MatchID,
		TeamID:         e.TeamID,
		Type:           EventType(e.Type),
		Minute:         e.Minute,
		PlayerID:       fromPgUUID(e.PlayerID),
		AssistPlayerID: fromPgUUID(e.AssistPlayerID),
		PlayerInID:     fromPgUUID(e.PlayerInID),
		OwnGoal:        e.OwnGoal,
		Penalty:        e.Penalty,
		Note:           e.Note,
	}
}

func playerName(id pgtype.UUID, firstname, lastname *string) *PlayerName {
	if !id.Valid || firstname == nil || lastname == nil {
		return nil
	}
	return &PlayerName{ID: id.Bytes, Firstname: *firstname, Lastname: *lastname}
}

func (s *PostgresStore) listEventRows(ctx context.Context, leagueID, seasonID, matchID uuid.UUID) ([]db.ListMatchEventsRow, error) {
	rows, err := s.q.ListMatchEvents(ctx, db.ListMatchEventsParams{LeagueID: leagueID, SeasonID: seasonID, MatchID: matchID})
	if err != nil {
		return nil, fmt.Errorf("list events of match %s: %w", matchID, err)
	}
	return rows, nil
}

func rowEvent(r db.ListMatchEventsRow) Event {
	return toEvent(db.MatchEvent{
		ID:             r.ID,
		MatchID:        r.MatchID,
		TeamID:         r.TeamID,
		Type:           r.Type,
		Minute:         r.Minute,
		PlayerID:       r.PlayerID,
		AssistPlayerID: r.AssistPlayerID,
		PlayerInID:     r.PlayerInID,
		OwnGoal:        r.OwnGoal,
		Penalty:        r.Penalty,
		Note:           r.Note,
	})
}

func (s *PostgresStore) ListEvents(ctx context.Context, leagueID, seasonID, matchID uuid.UUID) ([]Event, error) {
	rows, err := s.listEventRows(ctx, leagueID, seasonID, matchID)
	if err != nil {
		return nil, err
	}

	res := make([]Event, len(rows))
	for i, r := range rows {
		res[i] = rowEvent(r)
	}
	return res, nil
}

func (s *PostgresStore) ListEventViews(ctx context.Context, leagueID, seasonID, matchID uuid.UUID) ([]EventView, error) {
	rows, err := s.listEventRows(ctx, leagueID, seasonID, matchID)
	if err != nil {
		return nil, err
	}

	res := make([]EventView, len(rows))
	for i, r := range rows {
		res[i] = EventView{
			Event:        rowEvent(r),
			Player:       playerName(r.PlayerID, r.PlayerFirstname, r.PlayerLastname),
			AssistPlayer: playerName(r.AssistPlayerID, r.AssistFirstname, r.AssistLastname),
			PlayerIn:     playerName(r.PlayerInID, r.PlayerInFirstname, r.PlayerInLastname),
		}
	}
	return res, nil
}

func (s *PostgresStore) CreateEvent(ctx context.Context, leagueID, seasonID uuid.UUID, e Event) (Event, error) {
	res, err := s.q.CreateMatchEvent(ctx, db.CreateMatchEventParams{
		LeagueID:       leagueID,
		SeasonID:       seasonID,
		MatchID:        e.MatchID,
		TeamID:         e.TeamID,
		Type:           db.MatchEventType(e.Type),
		Minute:         e.Minute,
		PlayerID:       toPgUUID(e.PlayerID),
		AssistPlayerID: toPgUUID(e.AssistPlayerID),
		PlayerInID:     toPgUUID(e.PlayerInID),
		OwnGoal:        e.OwnGoal,
		Penalty:        e.Penalty,
		Note:           e.Note,
	})
	if err != nil {
		return Event{}, fmt.Errorf("create event of match %s: %w", e.MatchID, err)
	}
	return toEvent(res), nil
}

func (s *PostgresStore) DeleteEvent(ctx context.Context, leagueID, seasonID, matchID, id uuid.UUID) error {
	n, err := s.q.DeleteMatchEvent(ctx, db.DeleteMatchEventParams{ID: id, MatchID: matchID, SeasonID: seasonID, LeagueID: leagueID})
	if err != nil {
		return fmt.Errorf("delete event %s: %w", id, err)
	}
	if n == 0 {
		return ErrEventNotFound
	}
	return nil
}

func (s *PostgresStore) IsSquadMember(ctx context.Context, leagueID, seasonID, teamID, playerID uuid.UUID, day time.Time) (bool, error) {
	ok, err := s.q.IsSquadMemberOn(ctx, db.IsSquadMemberOnParams{
		LeagueID: leagueID,
		SeasonID: seasonID,
		TeamID:   teamID,
		PlayerID: playerID,
		Day:      day,
	})
	if err != nil {
		return false, fmt.Errorf("check squad of team %s for player %s: %w", teamID, playerID, err)
	}
	return ok, nil
}

func (s *PostgresStore) ListFinishedSeasonEvents(ctx context.Context, leagueID, seasonID uuid.UUID, types ...EventType) ([]EventView, error) {
	dbTypes := make([]string, len(types))
	for i, t := range types {
		dbTypes[i] = string(t)
	}

	rows, err := s.q.ListFinishedSeasonEvents(ctx, db.ListFinishedSeasonEventsParams{LeagueID: leagueID, SeasonID: seasonID, Types: dbTypes})
	if err != nil {
		return nil, fmt.Errorf("list events of season %s: %w", seasonID, err)
	}

	res := make([]EventView, len(rows))
	for i, r := range rows {
		res[i] = EventView{
			Event: toEvent(db.MatchEvent{
				ID:             r.ID,
				MatchID:        r.MatchID,
				TeamID:         r.TeamID,
				Type:           r.Type,
				Minute:         r.Minute,
				PlayerID:       r.PlayerID,
				AssistPlayerID: r.AssistPlayerID,
				PlayerInID:     r.PlayerInID,
				OwnGoal:        r.OwnGoal,
				Penalty:        r.Penalty,
				Note:           r.Note,
			}),
			Player:       playerName(r.PlayerID, r.PlayerFirstname, r.PlayerLastname),
			AssistPlayer: playerName(r.AssistPlayerID, r.AssistFirstname, r.AssistLastname),
		}
	}
	return res, nil
}
