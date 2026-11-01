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

func (s *PostgresStore) WithTx(tx pgx.Tx) *PostgresStore {
	return &PostgresStore{pool: s.pool, q: s.q.WithTx(tx)}
}

func (s *PostgresStore) InTx(ctx context.Context, fn func(store InvitationStore) error) error {
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

func (s *PostgresStore) LeagueAdmins(ctx context.Context, leagueID uuid.UUID) ([]User, error) {
	rows, err := s.q.ListLeagueAdmins(ctx, leagueID)
	if err != nil {
		return nil, fmt.Errorf("list admins of league %s: %w", leagueID, err)
	}

	res := make([]User, len(rows))
	for i, r := range rows {
		res[i] = toUser(r)
	}
	return res, nil
}

func (s *PostgresStore) RemoveLeagueAdmin(ctx context.Context, userID, leagueID uuid.UUID) error {
	n, err := s.q.RemoveLeagueAdmin(ctx, db.RemoveLeagueAdminParams{UserID: userID, LeagueID: leagueID})
	if err != nil {
		return fmt.Errorf("remove user %s from the admins of league %s: %w", userID, leagueID, err)
	}
	if n == 0 {
		return ErrRemoveAdminNotFound
	}
	return nil
}

func toInvitation(i db.Invitation) Invitation {
	return Invitation{ID: i.ID, LeagueID: i.LeagueID, Email: i.Email, ExpiresAt: i.ExpiresAt}
}

func (s *PostgresStore) ReplaceInvitation(ctx context.Context, leagueID uuid.UUID, email string, tokenHash []byte, expiresAt time.Time) (*Invitation, error) {
	var created db.Invitation

	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.DeletePendingInvitations(ctx, db.DeletePendingInvitationsParams{LeagueID: leagueID, Email: email}); err != nil {
			return err
		}

		var err error
		created, err = q.CreateInvitation(ctx, db.CreateInvitationParams{LeagueID: leagueID, Email: email, TokenHash: tokenHash, ExpiresAt: expiresAt})
		return err
	})

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == pgerrcode.ForeignKeyViolation {
		return nil, ErrInviteLeagueNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("create invitation to league %s: %w", leagueID, err)
	}

	return new(toInvitation(created)), nil
}

func (s *PostgresStore) Invitations(ctx context.Context, leagueID uuid.UUID, now time.Time) ([]Invitation, error) {
	rows, err := s.q.ListPendingInvitations(ctx, db.ListPendingInvitationsParams{LeagueID: leagueID, Now: now})
	if err != nil {
		return nil, fmt.Errorf("list invitations to league %s: %w", leagueID, err)
	}

	res := make([]Invitation, len(rows))
	for i, r := range rows {
		res[i] = toInvitation(r)
	}
	return res, nil
}

func (s *PostgresStore) DeleteInvitation(ctx context.Context, leagueID, id uuid.UUID) error {
	n, err := s.q.DeletePendingInvitation(ctx, db.DeletePendingInvitationParams{ID: id, LeagueID: leagueID})
	if err != nil {
		return fmt.Errorf("delete invitation %s: %w", id, err)
	}
	if n == 0 {
		return ErrInvitationNotFound
	}
	return nil
}

func (s *PostgresStore) PendingInvitation(ctx context.Context, tokenHash []byte, now time.Time) (*PendingInvitation, error) {
	row, err := s.q.GetPendingInvitation(ctx, db.GetPendingInvitationParams{TokenHash: tokenHash, Now: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvitationInvalidLink
	}
	if err != nil {
		return nil, fmt.Errorf("get invitation: %w", err)
	}

	_, err = s.Credentials(ctx, row.Email)
	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, err
	}

	return &PendingInvitation{
		Email:         row.Email,
		League:        League{ID: row.LeagueID, Name: row.LeagueName},
		AccountExists: err == nil,
	}, nil
}

func (s *PostgresStore) AcceptInvitation(ctx context.Context, tokenHash []byte, now time.Time) (*Invitation, error) {
	row, err := s.q.AcceptInvitation(ctx, db.AcceptInvitationParams{TokenHash: tokenHash, Now: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvitationInvalidLink
	}
	if err != nil {
		return nil, fmt.Errorf("accept invitation: %w", err)
	}

	return &Invitation{LeagueID: row.LeagueID, Email: row.Email}, nil
}

func (s *PostgresStore) DeleteExpired(ctx context.Context, now time.Time) (Cleaned, error) {
	var res Cleaned
	var err error

	if res.Sessions, err = s.q.DeleteExpiredSessions(ctx, now); err != nil {
		return Cleaned{}, fmt.Errorf("delete expired sessions: %w", err)
	}
	if res.PasswordResets, err = s.q.DeleteDeadPasswordResets(ctx, now); err != nil {
		return Cleaned{}, fmt.Errorf("delete expired password resets: %w", err)
	}
	if res.Invitations, err = s.q.DeleteExpiredInvitations(ctx, now); err != nil {
		return Cleaned{}, fmt.Errorf("delete expired invitations: %w", err)
	}
	return res, nil
}
