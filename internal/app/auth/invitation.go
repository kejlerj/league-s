package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

const InvitationTTL = 7 * 24 * time.Hour

type Invitation struct {
	ID        uuid.UUID
	LeagueID  uuid.UUID
	Email     string
	ExpiresAt time.Time
}

type PendingInvitation struct {
	Email         string
	League        League
	AccountExists bool
}

type InviteError string

func (e InviteError) Error() string { return string(e) }

const (
	ErrInviteAlreadyAdmin   InviteError = "this person is already an admin of the league"
	ErrInviteLeagueNotFound InviteError = "league not found"
)

type InvitationError string

func (e InvitationError) Error() string { return string(e) }

const (
	ErrInvitationInvalidLink     InvitationError = "invitation link is invalid or has expired"
	ErrInvitationAccountRequired InvitationError = "name and password are required to create the account"
	ErrInvitationNotFound        InvitationError = "invitation not found"
)

type RemoveAdminError string

func (e RemoveAdminError) Error() string { return string(e) }

const ErrRemoveAdminNotFound RemoveAdminError = "this user is not an admin of the league"

type InvitationStore interface {
	InTx(ctx context.Context, fn func(store InvitationStore) error) error
	Credentials(ctx context.Context, email string) (*Credentials, error)
	CreateUser(ctx context.Context, u User, passwordHash *string) (*User, error)
	IsLeagueAdmin(ctx context.Context, userID, leagueID uuid.UUID) (bool, error)
	AddLeagueAdmin(ctx context.Context, userID, leagueID uuid.UUID) error
	ReplaceInvitation(ctx context.Context, leagueID uuid.UUID, email string, tokenHash []byte, expiresAt time.Time) (*Invitation, error)
	PendingInvitation(ctx context.Context, tokenHash []byte, now time.Time) (*PendingInvitation, error)
	AcceptInvitation(ctx context.Context, tokenHash []byte, now time.Time) (*Invitation, error)
}

type Invitations struct {
	store InvitationStore
	now   func() time.Time
}

func NewInvitations(store InvitationStore) *Invitations {
	return &Invitations{store: store, now: time.Now}
}

func (s *Invitations) Invite(ctx context.Context, leagueID uuid.UUID, email string) (inv *Invitation, token string, err error) {
	email = NormalizeEmail(email)

	admin, err := s.isAdmin(ctx, s.store, leagueID, email)
	if err != nil {
		return nil, "", err
	}
	if admin {
		return nil, "", ErrInviteAlreadyAdmin
	}

	token, err = newToken()
	if err != nil {
		return nil, "", err
	}

	inv, err = s.store.ReplaceInvitation(ctx, leagueID, email, hashToken(token), s.now().Add(InvitationTTL))
	if err != nil {
		return nil, "", err
	}
	return inv, token, nil
}

func (s *Invitations) isAdmin(ctx context.Context, store InvitationStore, leagueID uuid.UUID, email string) (bool, error) {
	creds, err := store.Credentials(ctx, email)
	if errors.Is(err, ErrUserNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return store.IsLeagueAdmin(ctx, creds.User.ID, leagueID)
}

func (s *Invitations) Lookup(ctx context.Context, token string) (*PendingInvitation, error) {
	return s.store.PendingInvitation(ctx, hashToken(token), s.now())
}

func (s *Invitations) Accept(ctx context.Context, token, name, password string) error {
	pending, err := s.Lookup(ctx, token)
	if err != nil {
		return err
	}

	var passwordHash *string
	name = strings.TrimSpace(name)
	if !pending.AccountExists {
		if name == "" || password == "" {
			return ErrInvitationAccountRequired
		}
		hash, err := hashPassword(password)
		if err != nil {
			return err
		}
		passwordHash = &hash
	}

	return s.store.InTx(ctx, func(store InvitationStore) error {
		return s.accept(ctx, store, token, name, passwordHash)
	})
}

func (s *Invitations) accept(ctx context.Context, store InvitationStore, token, name string, passwordHash *string) error {
	inv, err := store.AcceptInvitation(ctx, hashToken(token), s.now())
	if err != nil {
		return err
	}

	userID, err := s.account(ctx, store, inv.Email, name, passwordHash)
	if err != nil {
		return err
	}

	return store.AddLeagueAdmin(ctx, userID, inv.LeagueID)
}

func (s *Invitations) account(ctx context.Context, store InvitationStore, email, name string, passwordHash *string) (uuid.UUID, error) {
	creds, err := store.Credentials(ctx, email)
	if err == nil {
		return creds.User.ID, nil
	}
	if !errors.Is(err, ErrUserNotFound) {
		return uuid.Nil, err
	}
	if passwordHash == nil {
		return uuid.Nil, ErrInvitationAccountRequired
	}

	user, err := store.CreateUser(ctx, User{Email: email, Name: name}, passwordHash)
	if err != nil {
		return uuid.Nil, err
	}
	return user.ID, nil
}
