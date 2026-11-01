//go:build integration

package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"league-s/internal/app/auth"
	"league-s/internal/mailer"
	"league-s/internal/testdb"
	"league-s/internal/testhttp"
)

func TestEveryResponseCarriesTheSecurityHeaders(t *testing.T) {
	testdb.New(t, testPool)
	router := (&Server{db: poolService{testPool}}).RegisterRoutes()

	for _, path := range []string{"/health", "/api/v1/leagues", "/api/v1/me", "/unknown"} {
		t.Run(path, func(t *testing.T) {
			h := testhttp.Do(t, router, http.MethodGet, path, "").Header()

			want := map[string]string{
				"X-Content-Type-Options":  "nosniff",
				"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
				"Referrer-Policy":         "no-referrer",
			}
			for name, value := range want {
				if got := h.Get(name); got != value {
					t.Errorf("%s = %q, want %q", name, got, value)
				}
			}
		})
	}
}

func TestTheAdminHasItsOwnContentSecurityPolicy(t *testing.T) {
	testdb.New(t, testPool)
	router := (&Server{db: poolService{testPool}}).RegisterRoutes()

	admin := "default-src 'self'; img-src 'self' https:; connect-src 'self' https://*.ingest.de.sentry.io; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
	tests := []struct {
		path string
		want string
	}{
		{"/admin/", admin},
		{"/admin/leagues/42", admin},
		{"/api/v1/leagues", "default-src 'none'; frame-ancestors 'none'"},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			h := testhttp.Do(t, router, http.MethodGet, tt.path, "").Header()
			if got := h.Values("Content-Security-Policy"); len(got) != 1 || got[0] != tt.want {
				t.Errorf("Content-Security-Policy = %q, want only %q", got, tt.want)
			}
		})
	}
}

func TestAuthenticatedResponsesAreNotStored(t *testing.T) {
	testdb.New(t, testPool)
	svc := auth.NewService(auth.NewPostgresStore(testPool), auth.EmailNotifier{Mailer: mailer.Disabled{}})
	if _, err := svc.CreateUser(t.Context(), "admin@example.com", "Test User", testPassword, false); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	router := (&Server{db: poolService{testPool}}).RegisterRoutes()
	cookie := loginCookie(t, router, "admin@example.com")

	withCookie := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
		req.AddCookie(cookie)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	withBearer := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+cookie.Value)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	tests := []struct {
		name string
		rec  *httptest.ResponseRecorder
		want string
	}{
		{"read with a session cookie", withCookie("/api/v1/me"), "no-store"},
		{"public read with a session cookie", withCookie("/api/v1/leagues"), "no-store"},
		{"read with a bearer token", withBearer("/api/v1/me"), "no-store"},
		{"login", testhttp.Do(t, router, http.MethodPost, "/api/v1/auth/login", `{"email": "admin@example.com", "password": "`+testPassword+`"}`), "no-store"},
		{"invitation lookup", testhttp.Do(t, router, http.MethodPost, "/api/v1/invitations/lookup", `{"token": "unknown"}`), "no-store"},
		{"anonymous public read", testhttp.Do(t, router, http.MethodGet, "/api/v1/leagues", ""), ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.rec.Header().Get("Cache-Control"); got != tt.want {
				t.Errorf("Cache-Control = %q, want %q (status %d)", got, tt.want, tt.rec.Code)
			}
		})
	}
}
