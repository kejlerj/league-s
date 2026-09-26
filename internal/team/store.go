package team

import (
	"context"
	"errors"
	"fmt"
	"league-s/internal/db"

	"github.com/jackc/pgx/v5"
)

type PostgresStore struct {
	q *db.Queries
}

func NewPostgresStore(q *db.Queries) *PostgresStore { return &PostgresStore{q: q} }

func (s *PostgresStore) Create(ctx context.Context, team *Team) (*Team, error) {
	res, err := s.q.CreateTeam(ctx, db.CreateTeamParams{
		Name: team.Name,
		Logo: team.Logo,
	})

	if err != nil {
		return nil, err
	}

	return &Team{
		ID:   res.ID,
		Name: res.Name,
		Logo: res.Logo,
	}, nil
}

func (s *PostgresStore) Get(ctx context.Context, id int64) (*Team, error) {
	team, err := s.q.GetTeamByID(ctx, id)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get team %d: %w", id, err)
	}

	return &Team{
		ID:   team.ID,
		Name: team.Name,
		Logo: team.Logo,
	}, nil
}
