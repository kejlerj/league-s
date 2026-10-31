package player

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/internal/db"
)

type PostgresStore struct {
	q *db.Queries
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{q: db.New(pool)}
}

func toPlayer(p db.Player) *Player {
	return &Player{
		ID:        p.ID,
		LeagueID:  p.LeagueID,
		Firstname: p.Firstname,
		Lastname:  p.Lastname,
		Icon:      p.Icon,
	}
}

func (s *PostgresStore) Create(ctx context.Context, player *Player) (*Player, error) {
	res, err := s.q.CreatePlayer(ctx, db.CreatePlayerParams{
		LeagueID:  player.LeagueID,
		Firstname: player.Firstname,
		Lastname:  player.Lastname,
		Icon:      player.Icon,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == pgerrcode.ForeignKeyViolation {
		return nil, ErrCreateLeagueNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("create player: %w", err)
	}

	return toPlayer(res), nil
}

func (s *PostgresStore) Get(ctx context.Context, leagueID, id uuid.UUID) (*Player, error) {
	player, err := s.q.GetPlayerByID(ctx, db.GetPlayerByIDParams{ID: id, LeagueID: leagueID})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGetNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get player %s: %w", id, err)
	}

	return toPlayer(player), nil
}

func (s *PostgresStore) List(ctx context.Context, leagueID uuid.UUID, search string) ([]*Player, error) {
	rows, err := s.q.ListPlayers(ctx, db.ListPlayersParams{LeagueID: leagueID, Search: search})
	if err != nil {
		return nil, fmt.Errorf("list players of league %s: %w", leagueID, err)
	}
	if len(rows) == 0 {
		exists, err := s.q.LeagueExists(ctx, leagueID)
		if err != nil {
			return nil, fmt.Errorf("check league %s: %w", leagueID, err)
		}
		if !exists {
			return nil, ErrListLeagueNotFound
		}
	}

	res := make([]*Player, len(rows))
	for i, r := range rows {
		res[i] = toPlayer(r)
	}
	return res, nil
}

func (s *PostgresStore) Update(ctx context.Context, leagueID, id uuid.UUID, u Update) (*Player, error) {
	res, err := s.q.UpdatePlayer(ctx, db.UpdatePlayerParams{
		ID:        id,
		LeagueID:  leagueID,
		Firstname: u.Firstname,
		Lastname:  u.Lastname,
		Icon:      u.Icon,
	})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUpdateNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("update player %s: %w", id, err)
	}

	return toPlayer(res), nil
}

func (s *PostgresStore) Delete(ctx context.Context, leagueID, id uuid.UUID) error {
	n, err := s.q.DeletePlayer(ctx, db.DeletePlayerParams{ID: id, LeagueID: leagueID})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && (pgErr.Code == pgerrcode.RestrictViolation || pgErr.Code == pgerrcode.ForeignKeyViolation) {
		return ErrDeleteHasHistory
	}
	if err != nil {
		return fmt.Errorf("delete player %s: %w", id, err)
	}
	if n == 0 {
		return ErrDeleteNotFound
	}
	return nil
}
