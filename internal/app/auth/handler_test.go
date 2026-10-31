//go:build integration

package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/testdb"
)

type fixture struct {
	router   http.Handler
	seed     *testdb.Seeder
	svc      *Service
	store    *PostgresStore
	notifier *fakeNotifier
}

func newFixture(t *testing.T, secureCookie bool) fixture {
	t.Helper()
	seed := testdb.New(t, testPool)
	store := NewPostgresStore(testPool)
	notifier := &fakeNotifier{tokens: map[string]string{}}
	svc := NewService(store, notifier)
	h := NewHandler(svc, store, secureCookie)

	r := chi.NewRouter()
	r.Use(svc.Identify)
	r.Mount("/api/v1/auth", h.Routes())
	r.Get("/api/v1/me", h.Me)
	r.Put("/api/v1/me/password", h.ChangePassword)

	return fixture{router: r, seed: seed, svc: svc, store: store, notifier: notifier}
}

func (f fixture) do(t *testing.T, method, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func (f fixture) login(t *testing.T, email string) *http.Cookie {
	t.Helper()
	rec := f.do(t, http.MethodPost, "/api/v1/auth/login", fmt.Sprintf(`{"email": %q, "password": %q}`, email, validPassword))
	if rec.Code != http.StatusOK {
		t.Fatalf("login: status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == CookieName {
			return c
		}
	}
	t.Fatal("login: no session cookie in the response")
	return nil
}

func TestLoginThenMe(t *testing.T) {
	f := newFixture(t, true)
	user := mustCreateUser(t, f.svc, "admin@example.com", false)
	bears := f.seed.CreateLeague(testdb.LeagueParams{Name: "Bears League"})
	alps := f.seed.CreateLeague(testdb.LeagueParams{Name: "Alps League"})
	f.seed.CreateLeague(testdb.LeagueParams{Name: "Not mine"})
	for _, leagueID := range []uuid.UUID{bears.ID, alps.ID} {
		if err := f.store.AddLeagueAdmin(t.Context(), user.ID, leagueID); err != nil {
			t.Fatalf("AddLeagueAdmin() error = %v", err)
		}
	}

	cookie := f.login(t, "Admin@Example.com")
	switch {
	case !cookie.HttpOnly:
		t.Error("the session cookie must be HttpOnly, so that scripts cannot read it")
	case !cookie.Secure:
		t.Error("the session cookie must be Secure")
	case cookie.SameSite != http.SameSiteLaxMode:
		t.Errorf("SameSite = %v, want Lax", cookie.SameSite)
	case cookie.MaxAge != int(SessionTTL.Seconds()):
		t.Errorf("MaxAge = %d, want %d", cookie.MaxAge, int(SessionTTL.Seconds()))
	}

	rec := f.do(t, http.MethodGet, "/api/v1/me", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("me: status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
	}
	if strings.Contains(rec.Body.String(), "password") {
		t.Errorf("me: body = %s, want no password field", rec.Body)
	}

	var me meResponse
	if err := json.NewDecoder(rec.Body).Decode(&me); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	switch {
	case me.ID != user.ID || me.Email != "admin@example.com" || me.IsSuperadmin:
		t.Errorf("me = %+v, want the admin who logged in", me)
	case len(me.Leagues) != 2 || me.Leagues[0].Name != "Alps League" || me.Leagues[1].Name != "Bears League":
		t.Errorf("leagues = %+v, want the two administered leagues sorted by name", me.Leagues)
	}
}

func TestLogin_CookieIsNotSecureWhenDisabled(t *testing.T) {
	f := newFixture(t, false)
	mustCreateUser(t, f.svc, "admin@example.com", false)

	if cookie := f.login(t, "admin@example.com"); cookie.Secure || !cookie.HttpOnly {
		t.Errorf("cookie = %+v, want HttpOnly without Secure for local http", cookie)
	}
}

func TestLogin_HTTPErrors(t *testing.T) {
	f := newFixture(t, true)
	mustCreateUser(t, f.svc, "admin@example.com", false)

	tests := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{"invalid JSON", `{"email":`, http.StatusBadRequest},
		{"missing password", `{"email": "admin@example.com"}`, http.StatusUnprocessableEntity},
		{"email is not an email", `{"email": "admin", "password": "x"}`, http.StatusUnprocessableEntity},
		{"unknown email", fmt.Sprintf(`{"email": "nobody@example.com", "password": %q}`, validPassword), http.StatusUnauthorized},
		{"wrong password", `{"email": "admin@example.com", "password": "not the right password"}`, http.StatusUnauthorized},
	}

	bodies := map[int]string{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := f.do(t, http.MethodPost, "/api/v1/auth/login", tt.body)
			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
			if len(rec.Result().Cookies()) != 0 {
				t.Error("a cookie was set on a failed login")
			}
			if tt.wantStatus == http.StatusUnauthorized {
				bodies[len(bodies)] = rec.Body.String()
			}
		})
	}
	if len(bodies) == 2 && bodies[0] != bodies[1] {
		t.Errorf("responses differ between an unknown email and a wrong password: %q vs %q", bodies[0], bodies[1])
	}
}

func TestMe_RequiresASession(t *testing.T) {
	f := newFixture(t, true)

	if rec := f.do(t, http.MethodGet, "/api/v1/me", ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("without a cookie: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	forged := &http.Cookie{Name: CookieName, Value: "not a token"}
	if rec := f.do(t, http.MethodGet, "/api/v1/me", "", forged); rec.Code != http.StatusUnauthorized {
		t.Errorf("with a forged cookie: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestLogout_EndsTheSession(t *testing.T) {
	f := newFixture(t, true)
	mustCreateUser(t, f.svc, "admin@example.com", false)
	cookie := f.login(t, "admin@example.com")

	rec := f.do(t, http.MethodPost, "/api/v1/auth/logout", "", cookie)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("logout: status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body)
	}
	cleared := rec.Result().Cookies()
	if len(cleared) != 1 || cleared[0].Name != CookieName || cleared[0].MaxAge >= 0 {
		t.Errorf("cookies = %+v, want the session cookie removed", cleared)
	}

	if rec := f.do(t, http.MethodGet, "/api/v1/me", "", cookie); rec.Code != http.StatusUnauthorized {
		t.Errorf("me with the old cookie: status = %d, want %d: the session must be gone on the server", rec.Code, http.StatusUnauthorized)
	}
	if rec := f.do(t, http.MethodPost, "/api/v1/auth/logout", ""); rec.Code != http.StatusNoContent {
		t.Errorf("logout without a session: status = %d, want %d", rec.Code, http.StatusNoContent)
	}
}

func TestStore_EmailIsUnique(t *testing.T) {
	f := newFixture(t, true)
	mustCreateUser(t, f.svc, "admin@example.com", false)

	if _, err := f.svc.CreateUser(t.Context(), "ADMIN@example.com", "Other", validPassword, false); !errors.Is(err, ErrCreateUserEmailTaken) {
		t.Errorf("CreateUser() error = %v, want ErrCreateUserEmailTaken", err)
	}
}

func TestSuperadminSetup_ThroughTheAPI(t *testing.T) {
	f := newFixture(t, true)
	if err := f.svc.EnsureSuperadmin(t.Context(), "me@example.com"); err != nil {
		t.Fatalf("EnsureSuperadmin() error = %v", err)
	}
	token := f.notifier.tokens["me@example.com"]

	body := fmt.Sprintf(`{"token": %q, "password": %q}`, token, newPassword)
	if rec := f.do(t, http.MethodPost, "/api/v1/auth/password-reset/confirm", body); rec.Code != http.StatusNoContent {
		t.Fatalf("confirm: status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body)
	}
	if rec := f.do(t, http.MethodPost, "/api/v1/auth/password-reset/confirm", body); rec.Code != http.StatusBadRequest {
		t.Errorf("confirm twice: status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	rec := f.do(t, http.MethodPost, "/api/v1/auth/login", fmt.Sprintf(`{"email": "me@example.com", "password": %q}`, newPassword))
	if rec.Code != http.StatusOK {
		t.Fatalf("login: status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
	}
	var user userResponse
	if err := json.NewDecoder(rec.Body).Decode(&user); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !user.IsSuperadmin {
		t.Errorf("user = %+v, want a superadmin", user)
	}
}

func TestPasswordReset_HTTP(t *testing.T) {
	f := newFixture(t, true)
	mustCreateUser(t, f.svc, "admin@example.com", false)

	known := f.do(t, http.MethodPost, "/api/v1/auth/password-reset", `{"email": "admin@example.com"}`)
	unknown := f.do(t, http.MethodPost, "/api/v1/auth/password-reset", `{"email": "nobody@example.com"}`)
	if known.Code != http.StatusNoContent || unknown.Code != http.StatusNoContent {
		t.Errorf("statuses = %d / %d, want %d for a known and an unknown email alike", known.Code, unknown.Code, http.StatusNoContent)
	}
	if strings.Contains(known.Body.String(), f.notifier.tokens["admin@example.com"]) && known.Body.Len() > 0 {
		t.Error("the response contains the reset token, want it delivered out of band only")
	}

	tests := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{"missing token", fmt.Sprintf(`{"password": %q}`, newPassword), http.StatusUnprocessableEntity},
		{"unknown token", fmt.Sprintf(`{"token": "not a token", "password": %q}`, newPassword), http.StatusBadRequest},
		{"password too short", fmt.Sprintf(`{"token": %q, "password": "short"}`, f.notifier.tokens["admin@example.com"]), http.StatusUnprocessableEntity},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := f.do(t, http.MethodPost, "/api/v1/auth/password-reset/confirm", tt.body); rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
		})
	}
}

func TestChangePassword_HTTP(t *testing.T) {
	f := newFixture(t, true)
	mustCreateUser(t, f.svc, "admin@example.com", false)
	cookie := f.login(t, "admin@example.com")
	valid := fmt.Sprintf(`{"current_password": %q, "new_password": %q}`, validPassword, newPassword)

	if rec := f.do(t, http.MethodPut, "/api/v1/me/password", valid); rec.Code != http.StatusUnauthorized {
		t.Errorf("without a session: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	wrong := fmt.Sprintf(`{"current_password": "not my password", "new_password": %q}`, newPassword)
	if rec := f.do(t, http.MethodPut, "/api/v1/me/password", wrong, cookie); rec.Code != http.StatusForbidden {
		t.Errorf("wrong current password: status = %d, want %d", rec.Code, http.StatusForbidden)
	}
	weak := fmt.Sprintf(`{"current_password": %q, "new_password": "short"}`, validPassword)
	if rec := f.do(t, http.MethodPut, "/api/v1/me/password", weak, cookie); rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("weak new password: status = %d, want %d", rec.Code, http.StatusUnprocessableEntity)
	}

	if rec := f.do(t, http.MethodPut, "/api/v1/me/password", valid, cookie); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body)
	}
	if rec := f.do(t, http.MethodGet, "/api/v1/me", "", cookie); rec.Code != http.StatusOK {
		t.Errorf("me with the same session: status = %d, want %d", rec.Code, http.StatusOK)
	}
}
