package auth

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const validPassword = "correct horse battery"

type fakeSession struct {
	userID    uuid.UUID
	expiresAt time.Time
}

type fakeReset struct {
	userID    uuid.UUID
	expiresAt time.Time
}

type fakeStore struct {
	users    map[string]Credentials
	sessions map[string]fakeSession
	resets   map[string]fakeReset
	admins   map[uuid.UUID]uuid.UUID
	extended int
}

type fakeNotifier struct {
	tokens map[string]string
}

func (n *fakeNotifier) PasswordReset(_ context.Context, user User, token string) {
	n.tokens[user.Email] = token
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		users:    map[string]Credentials{},
		sessions: map[string]fakeSession{},
		resets:   map[string]fakeReset{},
		admins:   map[uuid.UUID]uuid.UUID{},
	}
}

func (f *fakeStore) SetPassword(_ context.Context, userID uuid.UUID, passwordHash string) error {
	for email, creds := range f.users {
		if creds.User.ID == userID {
			creds.PasswordHash = &passwordHash
			f.users[email] = creds
		}
	}
	return nil
}

func (f *fakeStore) ReplacePasswordReset(_ context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error {
	for hash, r := range f.resets {
		if r.userID == userID {
			delete(f.resets, hash)
		}
	}
	f.resets[string(tokenHash)] = fakeReset{userID: userID, expiresAt: expiresAt}
	return nil
}

func (f *fakeStore) ResetPassword(ctx context.Context, tokenHash []byte, passwordHash string, now time.Time) (uuid.UUID, error) {
	r, ok := f.resets[string(tokenHash)]
	if !ok || !r.expiresAt.After(now) {
		return uuid.Nil, ErrResetInvalidLink
	}
	delete(f.resets, string(tokenHash))
	return r.userID, f.SetPassword(ctx, r.userID, passwordHash)
}

func (f *fakeStore) DeleteUserSessions(_ context.Context, userID uuid.UUID) error {
	for hash, s := range f.sessions {
		if s.userID == userID {
			delete(f.sessions, hash)
		}
	}
	return nil
}

func (f *fakeStore) DeleteOtherSessions(_ context.Context, userID uuid.UUID, keepTokenHash []byte) error {
	for hash, s := range f.sessions {
		if s.userID == userID && hash != string(keepTokenHash) {
			delete(f.sessions, hash)
		}
	}
	return nil
}

func (f *fakeStore) CreateUser(_ context.Context, u User, passwordHash *string) (*User, error) {
	if _, taken := f.users[u.Email]; taken {
		return nil, ErrCreateUserEmailTaken
	}
	u.ID = uuid.New()
	f.users[u.Email] = Credentials{User: u, PasswordHash: passwordHash}
	return &u, nil
}

func (f *fakeStore) Credentials(_ context.Context, email string) (*Credentials, error) {
	creds, ok := f.users[email]
	if !ok {
		return nil, ErrUserNotFound
	}
	return &creds, nil
}

func (f *fakeStore) CreateSession(_ context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error {
	f.sessions[string(tokenHash)] = fakeSession{userID: userID, expiresAt: expiresAt}
	return nil
}

func (f *fakeStore) Session(_ context.Context, tokenHash []byte, now time.Time) (*Session, error) {
	s, ok := f.sessions[string(tokenHash)]
	if !ok || !s.expiresAt.After(now) {
		return nil, ErrSessionNotFound
	}
	for _, creds := range f.users {
		if creds.User.ID == s.userID {
			return &Session{User: creds.User, ExpiresAt: s.expiresAt}, nil
		}
	}
	return nil, ErrSessionNotFound
}

func (f *fakeStore) ExtendSession(_ context.Context, tokenHash []byte, expiresAt time.Time) error {
	s := f.sessions[string(tokenHash)]
	s.expiresAt = expiresAt
	f.sessions[string(tokenHash)] = s
	f.extended++
	return nil
}

func (f *fakeStore) DeleteSession(_ context.Context, tokenHash []byte) error {
	delete(f.sessions, string(tokenHash))
	return nil
}

func (f *fakeStore) IsLeagueAdmin(_ context.Context, userID, leagueID uuid.UUID) (bool, error) {
	return f.admins[userID] == leagueID, nil
}

type clock struct{ now time.Time }

func (c *clock) advance(d time.Duration) { c.now = c.now.Add(d) }

func newTestService(t *testing.T) (*Service, *fakeStore, *clock) {
	t.Helper()
	svc, store, c, _ := newTestServiceWithNotifier(t)
	return svc, store, c
}

func newTestServiceWithNotifier(t *testing.T) (*Service, *fakeStore, *clock, *fakeNotifier) {
	t.Helper()
	store := newFakeStore()
	notifier := &fakeNotifier{tokens: map[string]string{}}
	c := &clock{now: time.Date(2026, time.October, 5, 12, 0, 0, 0, time.UTC)}
	svc := NewService(store, notifier)
	svc.now = func() time.Time { return c.now }
	return svc, store, c, notifier
}

func mustCreateUser(t *testing.T, svc *Service, email string, superadmin bool) *User {
	t.Helper()
	u, err := svc.CreateUser(t.Context(), email, "Test User", validPassword, superadmin)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	return u
}

func mustLogin(t *testing.T, svc *Service, email string) string {
	t.Helper()
	token, _, err := svc.Login(t.Context(), email, validPassword)
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	return token
}

func TestCreateUser(t *testing.T) {
	svc, store, _ := newTestService(t)

	u, err := svc.CreateUser(t.Context(), "  Admin@Example.COM ", "Admin", validPassword, false)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if u.Email != "admin@example.com" {
		t.Errorf("email = %q, want it trimmed and lowercased", u.Email)
	}
	if hash := store.users["admin@example.com"].PasswordHash; hash == nil || *hash == validPassword || !checkPassword(hash, validPassword) {
		t.Error("the stored value must be a hash that matches the password, never the password itself")
	}

	tests := []struct {
		name     string
		email    string
		password string
		wantErr  error
	}{
		{"email already used, whatever the case", "ADMIN@example.com", validPassword, ErrCreateUserEmailTaken},
		{"password too short", "other@example.com", "short", ErrPasswordTooShort},
		{"password too long", "other@example.com", strings.Repeat("a", 73), ErrPasswordTooLong},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := svc.CreateUser(t.Context(), tt.email, "Other", tt.password, false); !errors.Is(err, tt.wantErr) {
				t.Errorf("CreateUser() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestLogin(t *testing.T) {
	svc, store, c := newTestService(t)
	created := mustCreateUser(t, svc, "admin@example.com", false)

	token, user, err := svc.Login(t.Context(), " Admin@example.com", validPassword)
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if user.ID != created.ID {
		t.Errorf("user = %s, want %s", user.ID, created.ID)
	}

	session, ok := store.sessions[string(hashToken(token))]
	switch {
	case !ok:
		t.Fatal("no session stored under the hash of the token")
	case !session.expiresAt.Equal(c.now.Add(SessionTTL)):
		t.Errorf("session expires at %s, want %s", session.expiresAt, c.now.Add(SessionTTL))
	}
	if _, raw := store.sessions[token]; raw {
		t.Error("the token itself is stored, want only its hash")
	}
}

func TestLogin_Errors(t *testing.T) {
	svc, store, _ := newTestService(t)
	mustCreateUser(t, svc, "admin@example.com", false)

	tests := []struct {
		name     string
		email    string
		password string
	}{
		{"unknown email", "nobody@example.com", validPassword},
		{"wrong password", "admin@example.com", "not the right password"},
		{"empty password", "admin@example.com", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, user, err := svc.Login(t.Context(), tt.email, tt.password)
			if !errors.Is(err, ErrLoginInvalidCredentials) {
				t.Errorf("Login() error = %v, want ErrLoginInvalidCredentials", err)
			}
			if token != "" || user != nil || len(store.sessions) != 0 {
				t.Errorf("token = %q, user = %v, sessions = %d, want nothing created", token, user, len(store.sessions))
			}
		})
	}
}

func TestAuthenticate(t *testing.T) {
	svc, store, c := newTestService(t)
	created := mustCreateUser(t, svc, "admin@example.com", false)
	token := mustLogin(t, svc, "admin@example.com")

	user, err := svc.Authenticate(t.Context(), token)
	if err != nil || user.ID != created.ID {
		t.Fatalf("Authenticate() = %v, %v, want the user who logged in", user, err)
	}
	if store.extended != 0 {
		t.Errorf("session extended %d times right after login, want 0", store.extended)
	}

	c.advance(2 * 24 * time.Hour)
	if _, err := svc.Authenticate(t.Context(), token); err != nil {
		t.Fatalf("Authenticate() two days later: error = %v", err)
	}
	if got := store.sessions[string(hashToken(token))].expiresAt; store.extended != 1 || !got.Equal(c.now.Add(SessionTTL)) {
		t.Errorf("extended %d times, expires at %s, want one extension to %s", store.extended, got, c.now.Add(SessionTTL))
	}

	c.advance(SessionTTL + time.Second)
	if _, err := svc.Authenticate(t.Context(), token); !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("Authenticate() after expiry: error = %v, want ErrSessionNotFound", err)
	}

	if _, err := svc.Authenticate(t.Context(), "not a token"); !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("Authenticate() with an unknown token: error = %v, want ErrSessionNotFound", err)
	}
}

func TestLogout(t *testing.T) {
	svc, _, _ := newTestService(t)
	mustCreateUser(t, svc, "admin@example.com", false)
	token := mustLogin(t, svc, "admin@example.com")
	other := mustLogin(t, svc, "admin@example.com")

	if err := svc.Logout(t.Context(), token); err != nil {
		t.Fatalf("Logout() error = %v", err)
	}
	if _, err := svc.Authenticate(t.Context(), token); !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("Authenticate() after logout: error = %v, want ErrSessionNotFound", err)
	}
	if _, err := svc.Authenticate(t.Context(), other); err != nil {
		t.Errorf("the other session of the same user: error = %v, want it still valid", err)
	}
}

func TestWriteGuards(t *testing.T) {
	svc, store, _ := newTestService(t)
	league, otherLeague := uuid.New(), uuid.New()

	admin := mustCreateUser(t, svc, "admin@example.com", false)
	store.admins[admin.ID] = league
	mustCreateUser(t, svc, "super@example.com", true)
	mustCreateUser(t, svc, "nobody@example.com", false)

	tokens := map[string]string{
		"anonymous":            "",
		"unknown token":        "not a token",
		"league admin":         mustLogin(t, svc, "admin@example.com"),
		"superadmin":           mustLogin(t, svc, "super@example.com"),
		"logged in, no league": mustLogin(t, svc, "nobody@example.com"),
	}

	ok := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }
	r := chi.NewRouter()
	r.Use(svc.Identify)
	r.With(svc.LeagueAdminWrites("leagueID")).Route("/leagues/{leagueID}/teams", func(r chi.Router) {
		r.Get("/", ok)
		r.Post("/", ok)
	})
	r.With(SuperadminWrites).Route("/leagues", func(r chi.Router) {
		r.Get("/", ok)
		r.Post("/", ok)
	})

	teams := "/leagues/" + league.String() + "/teams/"
	otherTeams := "/leagues/" + otherLeague.String() + "/teams/"

	tests := []struct {
		who    string
		method string
		path   string
		want   int
	}{
		{"anonymous", http.MethodGet, teams, http.StatusOK},
		{"anonymous", http.MethodPost, teams, http.StatusUnauthorized},
		{"unknown token", http.MethodPost, teams, http.StatusUnauthorized},
		{"logged in, no league", http.MethodPost, teams, http.StatusForbidden},
		{"league admin", http.MethodPost, teams, http.StatusOK},
		{"league admin", http.MethodPost, otherTeams, http.StatusForbidden},
		{"league admin", http.MethodPost, "/leagues/abc/teams/", http.StatusForbidden},
		{"superadmin", http.MethodPost, teams, http.StatusOK},
		{"superadmin", http.MethodPost, otherTeams, http.StatusOK},

		{"anonymous", http.MethodGet, "/leagues/", http.StatusOK},
		{"anonymous", http.MethodPost, "/leagues/", http.StatusUnauthorized},
		{"league admin", http.MethodPost, "/leagues/", http.StatusForbidden},
		{"superadmin", http.MethodPost, "/leagues/", http.StatusOK},
	}

	for _, tt := range tests {
		for _, transport := range []string{"cookie", "bearer"} {
			t.Run(tt.who+" "+tt.method+" "+tt.path+" via "+transport, func(t *testing.T) {
				req := httptest.NewRequestWithContext(t.Context(), tt.method, tt.path, nil)
				if token := tokens[tt.who]; token != "" && transport == "cookie" {
					req.AddCookie(&http.Cookie{Name: CookieName, Value: token})
				} else if token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
				}

				rec := httptest.NewRecorder()
				r.ServeHTTP(rec, req)
				if rec.Code != tt.want {
					t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body)
				}
			})
		}
	}
}

func TestTokens(t *testing.T) {
	first, err := newToken()
	if err != nil {
		t.Fatalf("newToken() error = %v", err)
	}
	second, err := newToken()
	if err != nil {
		t.Fatalf("newToken() error = %v", err)
	}

	if first == second || len(first) < 40 {
		t.Errorf("tokens = %q and %q, want two different long random values", first, second)
	}
	again := hashToken(first)
	if len(again) != 32 || !bytes.Equal(again, hashToken(first)) || bytes.Equal(again, hashToken(second)) {
		t.Error("hashToken must be a stable 32-byte digest that differs between tokens")
	}
}

const newPassword = "a brand new password"

func TestEnsureSuperadmin(t *testing.T) {
	svc, store, _, notifier := newTestServiceWithNotifier(t)

	if err := svc.EnsureSuperadmin(t.Context(), " Me@Example.com"); err != nil {
		t.Fatalf("EnsureSuperadmin() error = %v", err)
	}
	creds, ok := store.users["me@example.com"]
	if !ok || !creds.User.IsSuperadmin || creds.PasswordHash != nil {
		t.Fatalf("account = %+v, want a superadmin without any password", creds)
	}
	first := notifier.tokens["me@example.com"]
	if first == "" {
		t.Fatal("no setup link was sent")
	}
	if _, _, err := svc.Login(t.Context(), "me@example.com", ""); !errors.Is(err, ErrLoginInvalidCredentials) {
		t.Errorf("Login() without a password set: error = %v, want ErrLoginInvalidCredentials", err)
	}

	if err := svc.EnsureSuperadmin(t.Context(), "me@example.com"); err != nil {
		t.Fatalf("second EnsureSuperadmin() error = %v", err)
	}
	second := notifier.tokens["me@example.com"]
	if second == first || len(store.users) != 1 {
		t.Errorf("want a fresh link and still one account while no password is set, got the same link or %d accounts", len(store.users))
	}
	if err := svc.ResetPassword(t.Context(), first, newPassword); !errors.Is(err, ErrResetInvalidLink) {
		t.Errorf("the first link: error = %v, want it replaced by the second", err)
	}

	if err := svc.ResetPassword(t.Context(), second, newPassword); err != nil {
		t.Fatalf("ResetPassword() error = %v", err)
	}
	delete(notifier.tokens, "me@example.com")
	if err := svc.EnsureSuperadmin(t.Context(), "me@example.com"); err != nil {
		t.Fatalf("EnsureSuperadmin() once the password is set: error = %v", err)
	}
	if _, sent := notifier.tokens["me@example.com"]; sent {
		t.Error("a link was sent although the superadmin already has a password")
	}
	if _, _, err := svc.Login(t.Context(), "me@example.com", newPassword); err != nil {
		t.Errorf("Login() with the chosen password: error = %v", err)
	}
}

func TestEnsureSuperadmin_RefusesAnExistingRegularAccount(t *testing.T) {
	svc, store, _, notifier := newTestServiceWithNotifier(t)
	mustCreateUser(t, svc, "admin@example.com", false)

	if err := svc.EnsureSuperadmin(t.Context(), "admin@example.com"); !errors.Is(err, ErrEnsureSuperadminNotSuperadmin) {
		t.Errorf("EnsureSuperadmin() error = %v, want ErrEnsureSuperadminNotSuperadmin", err)
	}
	if store.users["admin@example.com"].User.IsSuperadmin || len(notifier.tokens) != 0 {
		t.Error("the account was promoted or a link was sent, want nothing changed")
	}
}

func TestPasswordReset(t *testing.T) {
	svc, store, c, notifier := newTestServiceWithNotifier(t)
	mustCreateUser(t, svc, "admin@example.com", false)
	session := mustLogin(t, svc, "admin@example.com")

	if err := svc.RequestPasswordReset(t.Context(), "nobody@example.com"); err != nil {
		t.Fatalf("RequestPasswordReset() for an unknown email: error = %v, want nil", err)
	}
	if len(notifier.tokens) != 0 || len(store.resets) != 0 {
		t.Error("a link was created for an unknown email")
	}

	if err := svc.RequestPasswordReset(t.Context(), "Admin@example.com"); err != nil {
		t.Fatalf("RequestPasswordReset() error = %v", err)
	}
	token := notifier.tokens["admin@example.com"]
	if _, raw := store.resets[token]; token == "" || raw {
		t.Fatal("want a link sent and only the hash of its token stored")
	}

	if err := svc.ResetPassword(t.Context(), token, "short"); !errors.Is(err, ErrPasswordTooShort) {
		t.Errorf("weak password: error = %v, want ErrPasswordTooShort", err)
	}
	if err := svc.ResetPassword(t.Context(), token, newPassword); err != nil {
		t.Fatalf("ResetPassword() error = %v, want the link still usable after a refused password", err)
	}

	if _, _, err := svc.Login(t.Context(), "admin@example.com", validPassword); !errors.Is(err, ErrLoginInvalidCredentials) {
		t.Errorf("Login() with the old password: error = %v, want ErrLoginInvalidCredentials", err)
	}
	if _, _, err := svc.Login(t.Context(), "admin@example.com", newPassword); err != nil {
		t.Errorf("Login() with the new password: error = %v", err)
	}
	if _, err := svc.Authenticate(t.Context(), session); !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("the session opened before the reset: error = %v, want it closed", err)
	}
	if err := svc.ResetPassword(t.Context(), token, "another new password"); !errors.Is(err, ErrResetInvalidLink) {
		t.Errorf("using the link twice: error = %v, want ErrResetInvalidLink", err)
	}

	if err := svc.RequestPasswordReset(t.Context(), "admin@example.com"); err != nil {
		t.Fatalf("RequestPasswordReset() error = %v", err)
	}
	c.advance(ResetTTL + time.Second)
	if err := svc.ResetPassword(t.Context(), notifier.tokens["admin@example.com"], "another new password"); !errors.Is(err, ErrResetInvalidLink) {
		t.Errorf("expired link: error = %v, want ErrResetInvalidLink", err)
	}
}

func TestChangePassword(t *testing.T) {
	svc, _, _ := newTestService(t)
	user := mustCreateUser(t, svc, "admin@example.com", false)
	current := mustLogin(t, svc, "admin@example.com")
	other := mustLogin(t, svc, "admin@example.com")

	if err := svc.ChangePassword(t.Context(), user, current, "not my password", newPassword); !errors.Is(err, ErrChangePasswordWrongCurrent) {
		t.Errorf("wrong current password: error = %v, want ErrChangePasswordWrongCurrent", err)
	}
	if err := svc.ChangePassword(t.Context(), user, current, validPassword, "short"); !errors.Is(err, ErrPasswordTooShort) {
		t.Errorf("weak new password: error = %v, want ErrPasswordTooShort", err)
	}

	if err := svc.ChangePassword(t.Context(), user, current, validPassword, newPassword); err != nil {
		t.Fatalf("ChangePassword() error = %v", err)
	}
	if _, _, err := svc.Login(t.Context(), "admin@example.com", newPassword); err != nil {
		t.Errorf("Login() with the new password: error = %v", err)
	}
	if _, err := svc.Authenticate(t.Context(), current); err != nil {
		t.Errorf("the session that changed the password: error = %v, want it kept", err)
	}
	if _, err := svc.Authenticate(t.Context(), other); !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("the other session: error = %v, want it closed", err)
	}
}
