package match

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/internal/db"
)

type PostgresStore struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool, q: db.New(pool)}
}

func (s *PostgresStore) InTx(ctx context.Context, fn func(store Store) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := fn(&PostgresStore{pool: s.pool, q: s.q.WithTx(tx)}); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

func toMatch(m db.Match) *Match {
	res := &Match{
		id:         m.ID,
		seasonID:   m.SeasonID,
		homeTeamID: m.HomeTeamID,
		awayTeamID: m.AwayTeamID,
		matchday:   m.Matchday,
		kickoffAt:  m.KickoffAt,
		status:     Status(m.Status),
	}
	if m.HomeScore != nil && m.AwayScore != nil {
		res.score = &Score{Home: *m.HomeScore, Away: *m.AwayScore}
	}
	return res
}

func (s *PostgresStore) LockSeason(ctx context.Context, leagueID, seasonID uuid.UUID) (*Season, error) {
	res, err := s.q.LockSeason(ctx, db.LockSeasonParams{ID: seasonID, LeagueID: leagueID})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrScheduleSeasonNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock season %s: %w", seasonID, err)
	}

	return &Season{StartOn: res.StartOn, EndOn: res.EndOn}, nil
}

func (s *PostgresStore) CountOnMatchday(ctx context.Context, seasonID uuid.UUID, matchday int32, excludeID uuid.UUID, teamIDs ...uuid.UUID) (int64, error) {
	n, err := s.q.CountTeamMatchesOnMatchday(ctx, db.CountTeamMatchesOnMatchdayParams{
		SeasonID:  seasonID,
		Matchday:  matchday,
		ExcludeID: excludeID,
		TeamIds:   teamIDs,
	})
	if err != nil {
		return 0, fmt.Errorf("count matches on matchday %d of season %s: %w", matchday, seasonID, err)
	}

	return n, nil
}

func (s *PostgresStore) Create(ctx context.Context, m *Match) (*Match, error) {
	res, err := s.q.CreateMatch(ctx, db.CreateMatchParams{
		SeasonID:   m.seasonID,
		HomeTeamID: m.homeTeamID,
		AwayTeamID: m.awayTeamID,
		Matchday:   m.matchday,
		KickoffAt:  m.kickoffAt,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == pgerrcode.ForeignKeyViolation {
		return nil, ErrScheduleTeamNotRegistered
	}
	if err != nil {
		return nil, fmt.Errorf("create match in season %s: %w", m.seasonID, err)
	}

	return toMatch(res), nil
}

func (s *PostgresStore) Get(ctx context.Context, leagueID, seasonID, id uuid.UUID) (*Match, error) {
	res, err := s.q.GetMatch(ctx, db.GetMatchParams{ID: id, SeasonID: seasonID, LeagueID: leagueID})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGetNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get match %s: %w", id, err)
	}

	return toMatch(res), nil
}

func (s *PostgresStore) GetForUpdate(ctx context.Context, leagueID, seasonID, id uuid.UUID) (*Match, error) {
	res, err := s.q.GetMatchForUpdate(ctx, db.GetMatchForUpdateParams{ID: id, SeasonID: seasonID, LeagueID: leagueID})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGetNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock match %s: %w", id, err)
	}

	return toMatch(res), nil
}

func (s *PostgresStore) Save(ctx context.Context, leagueID uuid.UUID, m *Match) (*Match, error) {
	params := db.UpdateMatchParams{
		ID:        m.id,
		SeasonID:  m.seasonID,
		LeagueID:  leagueID,
		Matchday:  m.matchday,
		KickoffAt: m.kickoffAt,
		Status:    db.MatchStatus(m.status),
	}
	if m.score != nil {
		params.HomeScore = &m.score.Home
		params.AwayScore = &m.score.Away
	}

	res, err := s.q.UpdateMatch(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGetNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("save match %s: %w", m.id, err)
	}

	return toMatch(res), nil
}

func (s *PostgresStore) Delete(ctx context.Context, leagueID, seasonID, id uuid.UUID) error {
	n, err := s.q.DeleteMatch(ctx, db.DeleteMatchParams{ID: id, SeasonID: seasonID, LeagueID: leagueID})
	if err != nil {
		return fmt.Errorf("delete match %s: %w", id, err)
	}
	if n == 0 {
		return ErrGetNotFound
	}
	return nil
}

func (s *PostgresStore) List(ctx context.Context, leagueID, seasonID uuid.UUID, f Filter) ([]*Match, error) {
	params := db.ListMatchesParams{
		SeasonID: seasonID,
		LeagueID: leagueID,
		Matchday: f.Matchday,
		FromAt:   f.From,
		ToAt:     f.To,
	}
	if f.TeamID != nil {
		params.TeamID = pgtype.UUID{Bytes: *f.TeamID, Valid: true}
	}
	if f.Status != nil {
		params.Status = new(db.MatchStatus(*f.Status))
	}

	rows, err := s.q.ListMatches(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("list matches of season %s: %w", seasonID, err)
	}

	res := make([]*Match, len(rows))
	for i, r := range rows {
		res[i] = toMatch(r)
	}

	return res, nil
}
