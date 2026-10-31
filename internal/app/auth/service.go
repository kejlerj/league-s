package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Store interface {
	CreateUser(ctx context.Context, u User, passwordHash *string) (*User, error)
	Credentials(ctx context.Context, email string) (*Credentials, error)
	SetPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error
	CreateSession(ctx context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error
	Session(ctx context.Context, tokenHash []byte, now time.Time) (*Session, error)
	ExtendSession(ctx context.Context, tokenHash []byte, expiresAt time.Time) error
	DeleteSession(ctx context.Context, tokenHash []byte) error
	DeleteUserSessions(ctx context.Context, userID uuid.UUID) error
	DeleteOtherSessions(ctx context.Context, userID uuid.UUID, keepTokenHash []byte) error
	ReplacePasswordReset(ctx context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error
	ResetPassword(ctx context.Context, tokenHash []byte, passwordHash string, now time.Time) (uuid.UUID, error)
	IsLeagueAdmin(ctx context.Context, userID, leagueID uuid.UUID) (bool, error)
}

type Notifier interface {
	PasswordReset(ctx context.Context, user User, token string)
}

type Service struct {
	store    Store
	notifier Notifier
	now      func() time.Time
}

func NewService(store Store, notifier Notifier) *Service {
	return &Service{store: store, notifier: notifier, now: time.Now}
}

func (s *Service) CreateUser(ctx context.Context, email, name, password string, superadmin bool) (*User, error) {
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}

	return s.store.CreateUser(ctx, User{Email: NormalizeEmail(email), Name: name, IsSuperadmin: superadmin}, &hash)
}

func (s *Service) EnsureSuperadmin(ctx context.Context, email string) error {
	email = NormalizeEmail(email)

	creds, err := s.store.Credentials(ctx, email)
	if errors.Is(err, ErrUserNotFound) {
		user, err := s.store.CreateUser(ctx, User{Email: email, Name: "Superadmin", IsSuperadmin: true}, nil)
		if err != nil {
			return err
		}
		return s.sendReset(ctx, *user)
	}
	if err != nil {
		return err
	}

	if !creds.User.IsSuperadmin {
		return ErrEnsureSuperadminNotSuperadmin
	}
	if creds.PasswordHash != nil {
		return nil
	}
	return s.sendReset(ctx, creds.User)
}

func (s *Service) Login(ctx context.Context, email, password string) (token string, user *User, err error) {
	creds, err := s.store.Credentials(ctx, NormalizeEmail(email))
	if errors.Is(err, ErrUserNotFound) {
		checkPassword(nil, password)
		return "", nil, ErrLoginInvalidCredentials
	}
	if err != nil {
		return "", nil, err
	}
	if !checkPassword(creds.PasswordHash, password) {
		return "", nil, ErrLoginInvalidCredentials
	}

	token, err = newToken()
	if err != nil {
		return "", nil, err
	}
	if err := s.store.CreateSession(ctx, creds.User.ID, hashToken(token), s.now().Add(SessionTTL)); err != nil {
		return "", nil, err
	}

	return token, &creds.User, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (*User, error) {
	now := s.now()
	hash := hashToken(token)

	session, err := s.store.Session(ctx, hash, now)
	if err != nil {
		return nil, err
	}

	if session.ExpiresAt.Sub(now) < SessionTTL-sessionRefresh {
		if err := s.store.ExtendSession(ctx, hash, now.Add(SessionTTL)); err != nil {
			return nil, err
		}
	}

	return &session.User, nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	return s.store.DeleteSession(ctx, hashToken(token))
}

func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	creds, err := s.store.Credentials(ctx, NormalizeEmail(email))
	if errors.Is(err, ErrUserNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	return s.sendReset(ctx, creds.User)
}

func (s *Service) sendReset(ctx context.Context, user User) error {
	token, err := newToken()
	if err != nil {
		return err
	}
	if err := s.store.ReplacePasswordReset(ctx, user.ID, hashToken(token), s.now().Add(ResetTTL)); err != nil {
		return err
	}

	s.notifier.PasswordReset(ctx, user, token)
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, token, password string) error {
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}

	userID, err := s.store.ResetPassword(ctx, hashToken(token), hash, s.now())
	if err != nil {
		return err
	}

	return s.store.DeleteUserSessions(ctx, userID)
}

func (s *Service) ChangePassword(ctx context.Context, user *User, sessionToken, current, next string) error {
	creds, err := s.store.Credentials(ctx, user.Email)
	if err != nil {
		return err
	}
	if !checkPassword(creds.PasswordHash, current) {
		return ErrChangePasswordWrongCurrent
	}

	hash, err := hashPassword(next)
	if err != nil {
		return err
	}
	if err := s.store.SetPassword(ctx, user.ID, hash); err != nil {
		return err
	}

	return s.store.DeleteOtherSessions(ctx, user.ID, hashToken(sessionToken))
}

func (s *Service) CanWrite(ctx context.Context, user *User, leagueID uuid.UUID) (bool, error) {
	if user.IsSuperadmin {
		return true, nil
	}
	return s.store.IsLeagueAdmin(ctx, user.ID, leagueID)
}
