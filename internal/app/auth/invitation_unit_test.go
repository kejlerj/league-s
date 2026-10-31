package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeInvitation struct {
	Invitation
	accepted bool
}

type fakeInvitationStore struct {
	*fakeStore
	invitations map[string]*fakeInvitation
}

func (f *fakeInvitationStore) InTx(_ context.Context, fn func(store InvitationStore) error) error {
	return fn(f)
}

func (f *fakeInvitationStore) AddLeagueAdmin(_ context.Context, userID, leagueID uuid.UUID) error {
	f.admins[userID] = leagueID
	return nil
}

func (f *fakeInvitationStore) ReplaceInvitation(_ context.Context, leagueID uuid.UUID, email string, tokenHash []byte, expiresAt time.Time) (*Invitation, error) {
	for hash, inv := range f.invitations {
		if inv.LeagueID == leagueID && inv.Email == email && !inv.accepted {
			delete(f.invitations, hash)
		}
	}
	inv := Invitation{ID: uuid.New(), LeagueID: leagueID, Email: email, ExpiresAt: expiresAt}
	f.invitations[string(tokenHash)] = &fakeInvitation{Invitation: inv}
	return &inv, nil
}

func (f *fakeInvitationStore) pending(tokenHash []byte, now time.Time) (*fakeInvitation, bool) {
	inv, ok := f.invitations[string(tokenHash)]
	if !ok || inv.accepted || !inv.ExpiresAt.After(now) {
		return nil, false
	}
	return inv, true
}

func (f *fakeInvitationStore) PendingInvitation(_ context.Context, tokenHash []byte, now time.Time) (*PendingInvitation, error) {
	inv, ok := f.pending(tokenHash, now)
	if !ok {
		return nil, ErrInvitationInvalidLink
	}
	_, exists := f.users[inv.Email]
	return &PendingInvitation{Email: inv.Email, League: League{ID: inv.LeagueID}, AccountExists: exists}, nil
}

func (f *fakeInvitationStore) AcceptInvitation(_ context.Context, tokenHash []byte, now time.Time) (*Invitation, error) {
	inv, ok := f.pending(tokenHash, now)
	if !ok {
		return nil, ErrInvitationInvalidLink
	}
	inv.accepted = true
	return &inv.Invitation, nil
}

func newTestInvitations(t *testing.T) (*Invitations, *fakeInvitationStore, *clock) {
	t.Helper()
	store := &fakeInvitationStore{fakeStore: newFakeStore(), invitations: map[string]*fakeInvitation{}}
	c := &clock{now: time.Date(2026, time.October, 5, 12, 0, 0, 0, time.UTC)}
	svc := NewInvitations(store)
	svc.now = func() time.Time { return c.now }
	return svc, store, c
}

func mustInvite(t *testing.T, svc *Invitations, leagueID uuid.UUID, email string) string {
	t.Helper()
	_, token, err := svc.Invite(t.Context(), leagueID, email)
	if err != nil {
		t.Fatalf("Invite() error = %v", err)
	}
	return token
}

func TestInvite_TheLinkIsValidSevenDays(t *testing.T) {
	svc, _, c := newTestInvitations(t)
	inv, token, err := svc.Invite(t.Context(), uuid.New(), "admin@example.com")
	if err != nil {
		t.Fatalf("Invite() error = %v", err)
	}
	if want := c.now.Add(7 * 24 * time.Hour); !inv.ExpiresAt.Equal(want) {
		t.Errorf("ExpiresAt = %v, want %v", inv.ExpiresAt, want)
	}

	c.advance(7*24*time.Hour - time.Minute)
	if _, err := svc.Lookup(t.Context(), token); err != nil {
		t.Errorf("Lookup() a minute before the end: error = %v", err)
	}

	c.advance(time.Minute)
	if _, err := svc.Lookup(t.Context(), token); !errors.Is(err, ErrInvitationInvalidLink) {
		t.Errorf("Lookup() after 7 days: error = %v, want %v", err, ErrInvitationInvalidLink)
	}
	if err := svc.Accept(t.Context(), token, "Admin", validPassword); !errors.Is(err, ErrInvitationInvalidLink) {
		t.Errorf("Accept() after 7 days: error = %v, want %v", err, ErrInvitationInvalidLink)
	}
}

func TestInvite_RefusesAnAdminOfTheLeague(t *testing.T) {
	svc, store, _ := newTestInvitations(t)
	league, other := uuid.New(), uuid.New()
	user, err := store.CreateUser(t.Context(), User{Email: "admin@example.com", Name: "Admin"}, nil)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	store.admins[user.ID] = league

	if _, _, err := svc.Invite(t.Context(), league, "Admin@Example.com"); !errors.Is(err, ErrInviteAlreadyAdmin) {
		t.Errorf("Invite() to their own league: error = %v, want %v", err, ErrInviteAlreadyAdmin)
	}
	if _, _, err := svc.Invite(t.Context(), other, "admin@example.com"); err != nil {
		t.Errorf("Invite() to another league: error = %v", err)
	}
}

func TestInvite_ReplacesThePendingLink(t *testing.T) {
	svc, _, _ := newTestInvitations(t)
	league := uuid.New()
	first := mustInvite(t, svc, league, "admin@example.com")
	second := mustInvite(t, svc, league, "admin@example.com")

	if _, err := svc.Lookup(t.Context(), first); !errors.Is(err, ErrInvitationInvalidLink) {
		t.Errorf("Lookup() of the replaced link: error = %v, want %v", err, ErrInvitationInvalidLink)
	}
	if _, err := svc.Lookup(t.Context(), second); err != nil {
		t.Errorf("Lookup() of the new link: error = %v", err)
	}
}

func TestAccept_CreatesTheAccountWhenNoneExists(t *testing.T) {
	svc, store, _ := newTestInvitations(t)
	league := uuid.New()
	token := mustInvite(t, svc, league, "new@example.com")

	for _, tt := range []struct{ name, userName, password string }{
		{"without a name", " ", validPassword},
		{"without a password", "New Admin", ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if err := svc.Accept(t.Context(), token, tt.userName, tt.password); !errors.Is(err, ErrInvitationAccountRequired) {
				t.Errorf("Accept() error = %v, want %v", err, ErrInvitationAccountRequired)
			}
		})
	}
	if err := svc.Accept(t.Context(), token, "New Admin", "short"); !errors.Is(err, ErrPasswordTooShort) {
		t.Errorf("Accept() with a short password: error = %v, want %v", err, ErrPasswordTooShort)
	}

	if err := svc.Accept(t.Context(), token, " New Admin ", validPassword); err != nil {
		t.Fatalf("Accept() error = %v", err)
	}
	creds := store.users["new@example.com"]
	if creds.User.Name != "New Admin" || creds.PasswordHash == nil {
		t.Errorf("account = %+v, want the name and a password", creds)
	}
	if store.admins[creds.User.ID] != league {
		t.Errorf("the new account is not an admin of the league")
	}
}

func TestAccept_KeepsTheExistingAccount(t *testing.T) {
	svc, store, _ := newTestInvitations(t)
	league := uuid.New()
	hash := "existing-hash"
	user, err := store.CreateUser(t.Context(), User{Email: "known@example.com", Name: "Known"}, &hash)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	token := mustInvite(t, svc, league, "known@example.com")

	if err := svc.Accept(t.Context(), token, "Other Name", "other password"); err != nil {
		t.Fatalf("Accept() error = %v", err)
	}
	creds := store.users["known@example.com"]
	if creds.User.Name != "Known" || *creds.PasswordHash != hash {
		t.Errorf("account = %+v, want the name and password unchanged", creds)
	}
	if store.admins[user.ID] != league {
		t.Errorf("the existing account is not an admin of the league")
	}
}

func TestAccept_TheLinkWorksOnce(t *testing.T) {
	svc, _, _ := newTestInvitations(t)
	token := mustInvite(t, svc, uuid.New(), "new@example.com")

	if err := svc.Accept(t.Context(), token, "New Admin", validPassword); err != nil {
		t.Fatalf("Accept() error = %v", err)
	}
	if err := svc.Accept(t.Context(), token, "New Admin", validPassword); !errors.Is(err, ErrInvitationInvalidLink) {
		t.Errorf("Accept() twice: error = %v, want %v", err, ErrInvitationInvalidLink)
	}
}
