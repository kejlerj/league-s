package season

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/internal/app/team"
	"league-s/internal/db"
)

type PostgresStore struct {
	q *db.Queries
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{q: db.New(pool)}
}

func (s *PostgresStore) Create(ctx context.Context, season *Season) (*Season, error) {
	res, err := s.q.CreateSeason(ctx, db.CreateSeasonParams{
		Name:         season.Name,
		StartOn:      season.StartOn,
		EndOn:        season.EndOn,
		MatchWinPts:  season.MatchWinPts,
		MatchDrawPts: season.MatchDrawPts,
		MatchLossPts: season.MatchLossPts,
		TieBreakers:  season.TieBreakers,
		LeagueID:     season.LeagueID,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok {
		switch pgErr.ConstraintName {
		case "season_league_name_key":
			return nil, ErrCreateNameTaken
		case "season_league_id_fkey":
			return nil, ErrCreateLeagueNotFound
		}
	}
	if err != nil {
		return nil, fmt.Errorf("create season: %w", err)
	}

	return toSeason(res), nil
}

func (s *PostgresStore) Get(ctx context.Context, leagueID, id uuid.UUID) (*Season, error) {
	season, err := s.q.GetSeasonByID(ctx, db.GetSeasonByIDParams{ID: id, LeagueID: leagueID})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGetNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get season %s: %w", id, err)
	}

	return toSeason(season), nil
}

func (s *PostgresStore) GetByLeague(ctx context.Context, leagueID uuid.UUID) ([]*Season, error) {
	seasons, err := s.q.GetSeasonsByLeague(ctx, leagueID)

	if err != nil {
		return nil, err
	}

	res := make([]*Season, len(seasons))
	for i, season := range seasons {
		res[i] = toSeason(season)
	}

	return res, nil
}

func (s *PostgresStore) AddTeam(ctx context.Context, leagueID, seasonID, teamID uuid.UUID) error {
	_, err := s.q.AddTeamToSeason(ctx, db.AddTeamToSeasonParams{
		SeasonID: seasonID,
		TeamID:   teamID,
		LeagueID: leagueID,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok {
		switch {
		case pgErr.Code == pgerrcode.UniqueViolation:
			return ErrAddTeamAlreadyExists
		case pgErr.ConstraintName == "season_team_season_fkey":
			return ErrAddTeamSeasonNotFound
		case pgErr.ConstraintName == "season_team_team_fkey":
			return ErrAddTeamNotFound
		}
	}
	if err != nil {
		return fmt.Errorf("add team %s to season %s: %w", teamID, seasonID, err)
	}

	return nil
}

func (s *PostgresStore) GetTeams(ctx context.Context, leagueID, seasonID uuid.UUID) ([]*team.Team, error) {
	teams, err := s.q.GetTeamsBySeason(ctx, db.GetTeamsBySeasonParams{
		SeasonID: seasonID,
		LeagueID: leagueID,
	})

	if err != nil {
		return nil, err
	}

	res := make([]*team.Team, len(teams))
	for i, t := range teams {
		res[i] = &team.Team{
			ID:       t.ID,
			LeagueID: t.LeagueID,
			Name:     t.Name,
			Logo:     t.Logo,
		}
	}

	return res, nil
}

func (s *PostgresStore) RemoveTeam(ctx context.Context, leagueID, seasonID, teamID uuid.UUID) error {
	_, err := s.q.RemoveTeamFromSeason(ctx, db.RemoveTeamFromSeasonParams{
		SeasonID: seasonID,
		TeamID:   teamID,
		LeagueID: leagueID,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && (pgErr.Code == pgerrcode.RestrictViolation || pgErr.Code == pgerrcode.ForeignKeyViolation) {
		return ErrRemoveTeamHasMatches
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrRemoveTeamNotRegistered
	}
	if err != nil {
		return fmt.Errorf("remove team %s from season %s: %w", teamID, seasonID, err)
	}

	return nil
}

func toSeason(s db.Season) *Season {
	return &Season{
		ID:           s.ID,
		Name:         s.Name,
		StartOn:      s.StartOn,
		EndOn:        s.EndOn,
		MatchWinPts:  s.MatchWinPts,
		MatchDrawPts: s.MatchDrawPts,
		MatchLossPts: s.MatchLossPts,
		TieBreakers:  s.TieBreakers,
		LeagueID:     s.LeagueID,
	}
}
