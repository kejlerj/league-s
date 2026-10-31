package team

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

func toTeam(t db.Team) *Team {
	return &Team{
		ID:       t.ID,
		LeagueID: t.LeagueID,
		Name:     t.Name,
		Logo:     t.Logo,
	}
}

func (s *PostgresStore) Create(ctx context.Context, team *Team) (*Team, error) {
	res, err := s.q.CreateTeam(ctx, db.CreateTeamParams{
		LeagueID: team.LeagueID,
		Name:     team.Name,
		Logo:     team.Logo,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok {
		switch {
		case pgErr.ConstraintName == "team_league_name_key":
			return nil, ErrCreateNameTaken
		case pgErr.Code == pgerrcode.ForeignKeyViolation:
			return nil, ErrCreateLeagueNotFound
		}
	}
	if err != nil {
		return nil, fmt.Errorf("create team: %w", err)
	}

	return toTeam(res), nil
}

func (s *PostgresStore) Get(ctx context.Context, leagueID, id uuid.UUID) (*Team, error) {
	team, err := s.q.GetTeamByID(ctx, db.GetTeamByIDParams{ID: id, LeagueID: leagueID})

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrGetNotFound
		}
		return nil, fmt.Errorf("get team %s: %w", id, err)
	}

	return toTeam(team), nil
}

func (s *PostgresStore) List(ctx context.Context, leagueID uuid.UUID) ([]*Team, error) {
	teams, err := s.q.GetTeamsByLeagueID(ctx, leagueID)
	if err != nil {
		return nil, fmt.Errorf("list teams: %w", err)
	}
	if len(teams) == 0 {
		exists, err := s.q.LeagueExists(ctx, leagueID)
		if err != nil {
			return nil, fmt.Errorf("check league %s: %w", leagueID, err)
		}
		if !exists {
			return nil, ErrListLeagueNotFound
		}
	}

	res := make([]*Team, len(teams))
	for i, t := range teams {
		res[i] = toTeam(t)
	}

	return res, nil
}

func (s *PostgresStore) Update(ctx context.Context, leagueID, id uuid.UUID, u Update) (*Team, error) {
	res, err := s.q.UpdateTeam(ctx, db.UpdateTeamParams{ID: id, LeagueID: leagueID, Name: u.Name, Logo: u.Logo})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.ConstraintName == "team_league_name_key" {
		return nil, ErrUpdateNameTaken
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUpdateNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("update team %s: %w", id, err)
	}

	return toTeam(res), nil
}

func (s *PostgresStore) Delete(ctx context.Context, leagueID, id uuid.UUID) error {
	n, err := s.q.DeleteTeam(ctx, db.DeleteTeamParams{ID: id, LeagueID: leagueID})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && (pgErr.Code == pgerrcode.RestrictViolation || pgErr.Code == pgerrcode.ForeignKeyViolation) {
		return ErrDeleteHasHistory
	}
	if err != nil {
		return fmt.Errorf("delete team %s: %w", id, err)
	}
	if n == 0 {
		return ErrDeleteNotFound
	}
	return nil
}
