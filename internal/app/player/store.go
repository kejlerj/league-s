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
