package squadmembership

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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

func (s *PostgresStore) WithTx(tx pgx.Tx) *PostgresStore {
	return &PostgresStore{pool: s.pool, q: s.q.WithTx(tx)}
}

func (s *PostgresStore) InTx(ctx context.Context, fn func(store Store) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := fn(s.WithTx(tx)); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

func toMembership(m db.SquadMembership) *Membership {
	return &Membership{
		ID:       m.ID,
		LeagueID: m.LeagueID,
		SeasonID: m.SeasonID,
		TeamID:   m.TeamID,
		PlayerID: m.PlayerID,
		Number:   m.Number,
		JoinedOn: m.JoinedOn,
		LeftOn:   m.LeftOn,
	}
}

func (s *PostgresStore) Join(ctx context.Context, m *Membership) (*Membership, error) {
	res, err := s.q.CreateSquadMembership(ctx, db.CreateSquadMembershipParams{
		PlayerID: m.PlayerID,
		SeasonID: m.SeasonID,
		TeamID:   m.TeamID,
		LeagueID: m.LeagueID,
		Number:   m.Number,
		JoinedOn: m.JoinedOn,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok {
		switch pgErr.ConstraintName {
		case "squad_membership_player_fkey":
			return nil, ErrJoinPlayerNotFound
		case "squad_membership_season_team_fkey":
			return nil, ErrJoinTeamNotRegistered
		case "squad_membership_active_player":
			return nil, ErrJoinPlayerAlreadyActive
		case "squad_membership_active_number":
			return nil, ErrJoinNumberTaken
		}
	}
	if err != nil {
		return nil, fmt.Errorf("join player %s to team %s in season %s: %w", m.PlayerID, m.TeamID, m.SeasonID, err)
	}

	return toMembership(res), nil
}

func (s *PostgresStore) Leave(ctx context.Context, leagueID, seasonID, teamID, playerID uuid.UUID, leftOn time.Time) (*Membership, error) {
	res, err := s.q.CloseSquadMembership(ctx, db.CloseSquadMembershipParams{
		LeftOn:   leftOn,
		PlayerID: playerID,
		SeasonID: seasonID,
		TeamID:   teamID,
		LeagueID: leagueID,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok &&
		pgErr.Code == pgerrcode.CheckViolation && pgErr.ConstraintName == "squad_membership_left_after_joined" {
		return nil, ErrLeaveBeforeJoining
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrLeaveNotActive
	}
	if err != nil {
		return nil, fmt.Errorf("remove player %s from team %s in season %s: %w", playerID, teamID, seasonID, err)
	}

	return toMembership(res), nil
}

func (s *PostgresStore) Get(ctx context.Context, leagueID, seasonID, teamID, id uuid.UUID) (*Membership, error) {
	res, err := s.q.GetSquadMembership(ctx, db.GetSquadMembershipParams{
		ID:       id,
		SeasonID: seasonID,
		TeamID:   teamID,
		LeagueID: leagueID,
	})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGetNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get membership %s: %w", id, err)
	}

	return toMembership(res), nil
}

func (s *PostgresStore) ChangeNumber(ctx context.Context, leagueID, seasonID, teamID, id uuid.UUID, number *int32) (*Membership, error) {
	res, err := s.q.UpdateSquadMembershipNumber(ctx, db.UpdateSquadMembershipNumberParams{
		Number:   number,
		ID:       id,
		SeasonID: seasonID,
		TeamID:   teamID,
		LeagueID: leagueID,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.ConstraintName == "squad_membership_active_number" {
		return nil, ErrChangeNumberTaken
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrChangeNumberNotActive
	}
	if err != nil {
		return nil, fmt.Errorf("change number of membership %s: %w", id, err)
	}

	return toMembership(res), nil
}

func (s *PostgresStore) Active(ctx context.Context, leagueID, seasonID, playerID uuid.UUID) (*Membership, error) {
	res, err := s.q.GetActiveSquadMembership(ctx, db.GetActiveSquadMembershipParams{
		PlayerID: playerID,
		SeasonID: seasonID,
		LeagueID: leagueID,
	})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrActiveNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get active membership of player %s in season %s: %w", playerID, seasonID, err)
	}

	return toMembership(res), nil
}

func (s *PostgresStore) List(ctx context.Context, leagueID, seasonID, teamID uuid.UUID, includeHistory bool) ([]*Member, error) {
	rows, err := s.q.ListSquadMemberships(ctx, db.ListSquadMembershipsParams{
		SeasonID:       seasonID,
		TeamID:         teamID,
		LeagueID:       leagueID,
		IncludeHistory: includeHistory,
	})
	if err != nil {
		return nil, fmt.Errorf("list squad of team %s in season %s: %w", teamID, seasonID, err)
	}

	res := make([]*Member, len(rows))
	for i, r := range rows {
		res[i] = &Member{
			MembershipID: r.MembershipID,
			ID:           r.Player.ID,
			LeagueID:     r.Player.LeagueID,
			Firstname:    r.Player.Firstname,
			Lastname:     r.Player.Lastname,
			Icon:         r.Player.Icon,
			Number:       r.Number,
			JoinedOn:     r.JoinedOn,
			LeftOn:       r.LeftOn,
		}
	}

	return res, nil
}

func (s *PostgresStore) Rules(ctx context.Context, leagueID, seasonID, teamID uuid.UUID) (*SquadRules, error) {
	res, err := s.q.GetSquadRules(ctx, db.GetSquadRulesParams{
		SeasonID: seasonID,
		TeamID:   teamID,
		LeagueID: leagueID,
	})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRulesTeamNotRegistered
	}
	if err != nil {
		return nil, fmt.Errorf("get squad rules of team %s in season %s: %w", teamID, seasonID, err)
	}

	return &SquadRules{
		SeasonStartOn: res.StartOn,
		SeasonEndOn:   res.EndOn,
		MaxSize:       res.MaxSquadSize,
	}, nil
}

func (s *PostgresStore) LockSquad(ctx context.Context, leagueID, seasonID, teamID uuid.UUID) (*SquadRules, error) {
	res, err := s.q.LockSquad(ctx, db.LockSquadParams{
		SeasonID: seasonID,
		TeamID:   teamID,
		LeagueID: leagueID,
	})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrLockTeamNotRegistered
	}
	if err != nil {
		return nil, fmt.Errorf("lock squad of team %s in season %s: %w", teamID, seasonID, err)
	}

	return &SquadRules{
		SeasonStartOn: res.StartOn,
		SeasonEndOn:   res.EndOn,
		MaxSize:       res.MaxSquadSize,
	}, nil
}

func (s *PostgresStore) CountActive(ctx context.Context, leagueID, seasonID, teamID uuid.UUID) (int64, error) {
	n, err := s.q.CountActiveSquadMembers(ctx, db.CountActiveSquadMembersParams{
		SeasonID: seasonID,
		TeamID:   teamID,
		LeagueID: leagueID,
	})
	if err != nil {
		return 0, fmt.Errorf("count active members of team %s in season %s: %w", teamID, seasonID, err)
	}

	return n, nil
}
