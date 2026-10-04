package league

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

func (s *PostgresStore) Create(ctx context.Context, league *League) (*League, error) {
	res, err := s.q.CreateLeague(ctx, db.CreateLeagueParams{
		Name: league.Name,
		Logo: league.Logo,
	})

	if err != nil {
		return nil, err
	}

	return &League{
		ID:   res.ID,
		Name: res.Name,
		Logo: res.Logo,
	}, nil
}

func (s *PostgresStore) Get(ctx context.Context, id uuid.UUID) (*League, error) {
	league, err := s.q.GetLeagueByID(ctx, id)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGetNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get league %s: %w", id, err)
	}

	return &League{
		ID:   league.ID,
		Name: league.Name,
		Logo: league.Logo,
	}, nil
}

func (s *PostgresStore) List(ctx context.Context) ([]*League, error) {
	leagues, err := s.q.GetLeagues(ctx)
	if err != nil {
		return nil, fmt.Errorf("list leagues: %w", err)
	}

	res := make([]*League, len(leagues))
	for i, l := range leagues {
		res[i] = &League{
			ID:   l.ID,
			Name: l.Name,
			Logo: l.Logo,
		}
	}

	return res, nil
}

func (s *PostgresStore) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.q.DeleteLeague(ctx, id)

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && (pgErr.Code == pgerrcode.RestrictViolation || pgErr.Code == pgerrcode.ForeignKeyViolation) {
		return ErrDeleteHasHistory
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrDeleteNotFound
	}
	if err != nil {
		return fmt.Errorf("delete league %s: %w", id, err)
	}

	return nil
}
