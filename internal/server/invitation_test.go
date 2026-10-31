//go:build integration

package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"league-s/internal/app/auth"
	"league-s/internal/mailer"
	"league-s/internal/testdb"
)

type invitationFixture struct {
	router http.Handler
	base   string
	super  *http.Cookie
}

func newInvitationFixture(t *testing.T) invitationFixture {
	t.Helper()
	seed := testdb.New(t, testPool)
	league := seed.CreateLeague(testdb.LeagueParams{Name: "Bears League"})

	svc := auth.NewService(auth.NewPostgresStore(testPool), auth.EmailNotifier{Mailer: mailer.Disabled{}})
	if _, err := svc.CreateUser(t.Context(), "super@example.com", "Super", testPassword, true); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	router := (&Server{db: poolService{testPool}, adminURL: "https://admin.example.com"}).RegisterRoutes()
	return invitationFixture{
		router: router,
		base:   fmt.Sprintf("/api/v1/leagues/%s", league.ID),
		super:  loginCookie(t, router, "super@example.com"),
	}
}

func (f invitationFixture) do(t *testing.T, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func (f invitationFixture) invite(t *testing.T, email string) (id, token string) {
	t.Helper()
	rec := f.do(t, http.MethodPost, f.base+"/invitations", fmt.Sprintf(`{"email": %q}`, email), f.super)
	if rec.Code != http.StatusCreated {
		t.Fatalf("invite %s: status = %d, want %d, body = %s", email, rec.Code, http.StatusCreated, rec.Body)
	}

	var res struct {
		ID   string `json:"id"`
		Link string `json:"link"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("decode invitation: %v", err)
	}

	link, err := url.Parse(res.Link)
	if err != nil || link.Host != "admin.example.com" || link.Path != "/invitation" || link.Query().Get("token") == "" {
		t.Fatalf("link = %q, want https://admin.example.com/invitation?token=...", res.Link)
	}
	return res.ID, link.Query().Get("token")
}

func (f invitationFixture) accept(t *testing.T, token, name, password string) *httptest.ResponseRecorder {
	t.Helper()
	body := fmt.Sprintf(`{"token": %q, "name": %q, "password": %q}`, token, name, password)
	return f.do(t, http.MethodPost, "/api/v1/invitations/accept", body, nil)
}

func (f invitationFixture) admins(t *testing.T) []string {
	t.Helper()
	rec := f.do(t, http.MethodGet, f.base+"/admins", "", f.super)
	if rec.Code != http.StatusOK {
		t.Fatalf("list admins: status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
	}

	var res []struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("decode admins: %v", err)
	}

	emails := make([]string, len(res))
	for i, a := range res {
		emails[i] = a.Email
	}
	return emails
}

func TestInvitation_NewAccount(t *testing.T) {
	f := newInvitationFixture(t)
	_, token := f.invite(t, "New.Admin@Example.com")

	rec := f.do(t, http.MethodPost, "/api/v1/invitations/lookup", fmt.Sprintf(`{"token": %q}`, token), nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("lookup: status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
	}
	want := `"email":"new.admin@example.com"`
	if body := rec.Body.String(); !strings.Contains(body, want) || !strings.Contains(body, `"name":"Bears League"`) || !strings.Contains(body, `"account_exists":false`) {
		t.Errorf("lookup body = %s, want the invited email, the league and no account", body)
	}

	rejected := []struct {
		name     string
		userName string
		password string
		want     int
	}{
		{"without a name", "", testPassword, http.StatusUnprocessableEntity},
		{"without a password", "New Admin", "", http.StatusUnprocessableEntity},
		{"with a password too short", "New Admin", "short", http.StatusUnprocessableEntity},
	}
	for _, tt := range rejected {
		t.Run(tt.name, func(t *testing.T) {
			if rec := f.accept(t, token, tt.userName, tt.password); rec.Code != tt.want {
				t.Errorf("accept: status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body)
			}
		})
	}

	if rec := f.accept(t, token, "New Admin", testPassword); rec.Code != http.StatusNoContent {
		t.Fatalf("accept: status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body)
	}
	if rec := f.accept(t, token, "New Admin", testPassword); rec.Code != http.StatusBadRequest {
		t.Errorf("accept twice: status = %d, want %d: the link works once", rec.Code, http.StatusBadRequest)
	}

	cookie := loginCookie(t, f.router, "new.admin@example.com")
	if rec := f.do(t, http.MethodPost, f.base+"/teams", `{"name": "Bears"}`, cookie); rec.Code != http.StatusCreated {
		t.Errorf("create a team as the new admin: status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body)
	}
	if got := f.admins(t); len(got) != 1 || got[0] != "new.admin@example.com" {
		t.Errorf("admins = %v, want only the new admin", got)
	}

	rec = f.do(t, http.MethodPost, f.base+"/invitations", `{"email": "new.admin@example.com"}`, f.super)
	if rec.Code != http.StatusConflict {
		t.Errorf("invite an admin of the league: status = %d, want %d", rec.Code, http.StatusConflict)
	}
}

func TestInvitation_ExistingAccount(t *testing.T) {
	f := newInvitationFixture(t)
	svc := auth.NewService(auth.NewPostgresStore(testPool), auth.EmailNotifier{Mailer: mailer.Disabled{}})
	if _, err := svc.CreateUser(t.Context(), "known@example.com", "Known", testPassword, false); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	_, token := f.invite(t, "known@example.com")

	rec := f.do(t, http.MethodPost, "/api/v1/invitations/lookup", fmt.Sprintf(`{"token": %q}`, token), nil)
	if !strings.Contains(rec.Body.String(), `"account_exists":true`) {
		t.Errorf("lookup body = %s, want account_exists true", rec.Body)
	}

	rec = f.do(t, http.MethodPost, "/api/v1/invitations/accept", fmt.Sprintf(`{"token": %q}`, token), nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("accept: status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body)
	}

	loginCookie(t, f.router, "known@example.com")
	if got := f.admins(t); len(got) != 1 || got[0] != "known@example.com" {
		t.Errorf("admins = %v, want the existing account", got)
	}
}

func TestInvitation_ReplaceAndCancel(t *testing.T) {
	f := newInvitationFixture(t)

	_, first := f.invite(t, "admin@example.com")
	id, second := f.invite(t, "admin@example.com")

	if rec := f.accept(t, first, "Admin", testPassword); rec.Code != http.StatusBadRequest {
		t.Errorf("accept the replaced link: status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	rec := f.do(t, http.MethodGet, f.base+"/invitations", "", f.super)
	if rec.Code != http.StatusOK || strings.Count(rec.Body.String(), `"email"`) != 1 {
		t.Errorf("list: status = %d, body = %s, want one pending invitation", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), second) || strings.Contains(rec.Body.String(), "link") {
		t.Errorf("list body = %s, want no token and no link", rec.Body)
	}

	if rec := f.do(t, http.MethodDelete, f.base+"/invitations/"+id, "", f.super); rec.Code != http.StatusNoContent {
		t.Fatalf("cancel: status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body)
	}
	if rec := f.do(t, http.MethodDelete, f.base+"/invitations/"+id, "", f.super); rec.Code != http.StatusNotFound {
		t.Errorf("cancel twice: status = %d, want %d", rec.Code, http.StatusNotFound)
	}
	if rec := f.accept(t, second, "Admin", testPassword); rec.Code != http.StatusBadRequest {
		t.Errorf("accept the cancelled link: status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestInvitation_Access(t *testing.T) {
	f := newInvitationFixture(t)
	_, token := f.invite(t, "admin@example.com")
	if rec := f.accept(t, token, "Admin", testPassword); rec.Code != http.StatusNoContent {
		t.Fatalf("accept: status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body)
	}
	admin := loginCookie(t, f.router, "admin@example.com")

	var adminID string
	rec := f.do(t, http.MethodGet, "/api/v1/me", "", admin)
	var me struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatalf("decode me: %v", err)
	}
	adminID = me.ID

	tests := []struct {
		name   string
		method string
		path   string
		body   string
		cookie *http.Cookie
		want   int
	}{
		{"anonymous invites", http.MethodPost, f.base + "/invitations", `{"email": "x@example.com"}`, nil, http.StatusUnauthorized},
		{"league admin invites", http.MethodPost, f.base + "/invitations", `{"email": "x@example.com"}`, admin, http.StatusForbidden},
		{"anonymous lists invitations", http.MethodGet, f.base + "/invitations", "", nil, http.StatusUnauthorized},
		{"league admin lists invitations", http.MethodGet, f.base + "/invitations", "", admin, http.StatusForbidden},
		{"anonymous lists admins", http.MethodGet, f.base + "/admins", "", nil, http.StatusUnauthorized},
		{"league admin lists admins", http.MethodGet, f.base + "/admins", "", admin, http.StatusOK},
		{"league admin removes an admin", http.MethodDelete, f.base + "/admins/" + adminID, "", admin, http.StatusForbidden},
		{"invalid email", http.MethodPost, f.base + "/invitations", `{"email": "nope"}`, f.super, http.StatusUnprocessableEntity},
		{"unknown league", http.MethodPost, "/api/v1/leagues/01a10d58-8ae3-7c66-ac38-c7cac896cc65/invitations", `{"email": "x@example.com"}`, f.super, http.StatusNotFound},
		{"unknown link", http.MethodPost, "/api/v1/invitations/lookup", `{"token": "nope"}`, nil, http.StatusBadRequest},
		{"superadmin removes an admin", http.MethodDelete, f.base + "/admins/" + adminID, "", f.super, http.StatusNoContent},
		{"superadmin removes them twice", http.MethodDelete, f.base + "/admins/" + adminID, "", f.super, http.StatusNotFound},
		{"removed admin writes", http.MethodPost, f.base + "/teams", `{"name": "Bears"}`, admin, http.StatusForbidden},
		{"removed admin lists admins", http.MethodGet, f.base + "/admins", "", admin, http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := f.do(t, tt.method, tt.path, tt.body, tt.cookie); rec.Code != tt.want {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body)
			}
		})
	}
}
