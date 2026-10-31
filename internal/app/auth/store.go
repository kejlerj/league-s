package auth

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

func toUser(u db.AppUser) User {
	return User{ID: u.ID, Email: u.Email, Name: u.Name, IsSuperadmin: u.IsSuperadmin}
}

func (s *PostgresStore) CreateUser(ctx context.Context, u User, passwordHash *string) (*User, error) {
	res, err := s.q.CreateUser(ctx, db.CreateUserParams{
		Email:        u.Email,
		Name:         u.Name,
		PasswordHash: passwordHash,
		IsSuperadmin: u.IsSuperadmin,
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == pgerrcode.UniqueViolation {
		return nil, ErrCreateUserEmailTaken
	}
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	return new(toUser(res)), nil
}

func (s *PostgresStore) Credentials(ctx context.Context, email string) (*Credentials, error) {
	res, err := s.q.GetUserByEmail(ctx, email)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get user by email: %w", err)
	}

	return &Credentials{User: toUser(res), PasswordHash: res.PasswordHash}, nil
}

func (s *PostgresStore) CreateSession(ctx context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error {
	err := s.q.CreateSession(ctx, db.CreateSessionParams{UserID: userID, TokenHash: tokenHash, ExpiresAt: expiresAt})
	if err != nil {
		return fmt.Errorf("create session for user %s: %w", userID, err)
	}
	return nil
}

func (s *PostgresStore) Session(ctx context.Context, tokenHash []byte, now time.Time) (*Session, error) {
	res, err := s.q.GetSessionUser(ctx, db.GetSessionUserParams{TokenHash: tokenHash, Now: now})

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}

	return &Session{User: toUser(res.AppUser), ExpiresAt: res.ExpiresAt}, nil
}

func (s *PostgresStore) ExtendSession(ctx context.Context, tokenHash []byte, expiresAt time.Time) error {
	if err := s.q.ExtendSession(ctx, db.ExtendSessionParams{TokenHash: tokenHash, ExpiresAt: expiresAt}); err != nil {
		return fmt.Errorf("extend session: %w", err)
	}
	return nil
}

func (s *PostgresStore) DeleteSession(ctx context.Context, tokenHash []byte) error {
	if err := s.q.DeleteSession(ctx, tokenHash); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (s *PostgresStore) AddLeagueAdmin(ctx context.Context, userID, leagueID uuid.UUID) error {
	if err := s.q.AddLeagueAdmin(ctx, db.AddLeagueAdminParams{UserID: userID, LeagueID: leagueID}); err != nil {
		return fmt.Errorf("make user %s admin of league %s: %w", userID, leagueID, err)
	}
	return nil
}

func (s *PostgresStore) IsLeagueAdmin(ctx context.Context, userID, leagueID uuid.UUID) (bool, error) {
	ok, err := s.q.IsLeagueAdmin(ctx, db.IsLeagueAdminParams{UserID: userID, LeagueID: leagueID})
	if err != nil {
		return false, fmt.Errorf("check user %s on league %s: %w", userID, leagueID, err)
	}
	return ok, nil
}

func (s *PostgresStore) AdminLeagues(ctx context.Context, userID uuid.UUID) ([]League, error) {
	rows, err := s.q.ListAdminLeagues(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list leagues of user %s: %w", userID, err)
	}

	res := make([]League, len(rows))
	for i, r := range rows {
		res[i] = League{ID: r.ID, Name: r.Name}
	}
	return res, nil
}

func (s *PostgresStore) SetPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	if err := s.q.SetPassword(ctx, db.SetPasswordParams{ID: userID, PasswordHash: &passwordHash}); err != nil {
		return fmt.Errorf("set password of user %s: %w", userID, err)
	}
	return nil
}

func (s *PostgresStore) ReplacePasswordReset(ctx context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error {
	if err := s.q.DeletePasswordResets(ctx, userID); err != nil {
		return fmt.Errorf("delete password resets of user %s: %w", userID, err)
	}

	err := s.q.CreatePasswordReset(ctx, db.CreatePasswordResetParams{UserID: userID, TokenHash: tokenHash, ExpiresAt: expiresAt})
	if err != nil {
		return fmt.Errorf("create password reset for user %s: %w", userID, err)
	}
	return nil
}

func (s *PostgresStore) ResetPassword(ctx context.Context, tokenHash []byte, passwordHash string, now time.Time) (uuid.UUID, error) {
	userID, err := s.q.ResetPassword(ctx, db.ResetPasswordParams{TokenHash: tokenHash, PasswordHash: &passwordHash, Now: now})

	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrResetInvalidLink
	}
	if err != nil {
		return uuid.Nil, fmt.Errorf("reset password: %w", err)
	}

	return userID, nil
}

func (s *PostgresStore) DeleteUserSessions(ctx context.Context, userID uuid.UUID) error {
	if err := s.q.DeleteUserSessions(ctx, userID); err != nil {
		return fmt.Errorf("delete sessions of user %s: %w", userID, err)
	}
	return nil
}

func (s *PostgresStore) DeleteOtherSessions(ctx context.Context, userID uuid.UUID, keepTokenHash []byte) error {
	if err := s.q.DeleteOtherSessions(ctx, db.DeleteOtherSessionsParams{UserID: userID, TokenHash: keepTokenHash}); err != nil {
		return fmt.Errorf("delete other sessions of user %s: %w", userID, err)
	}
	return nil
}
