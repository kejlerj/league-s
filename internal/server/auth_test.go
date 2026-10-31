//go:build integration

package server

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"league-s/internal/app/auth"
	"league-s/internal/mailer"
	"league-s/internal/testdb"
)

const testPassword = "correct horse battery"

func loginCookie(t *testing.T, router http.Handler, email string) *http.Cookie {
	t.Helper()
	body := fmt.Sprintf(`{"email": %q, "password": %q}`, email, testPassword)
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/v1/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("login %s: status = %d, want %d, body = %s", email, rec.Code, http.StatusOK, rec.Body)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == auth.CookieName {
			return c
		}
	}
	t.Fatalf("login %s: no session cookie", email)
	return nil
}

func TestWritesAreReservedToTheAdminsOfTheLeague(t *testing.T) {
	seed := testdb.New(t, testPool)
	league := seed.CreateLeague(testdb.LeagueParams{})
	other := seed.CreateLeague(testdb.LeagueParams{})
	season := seed.CreateSeason(testdb.SeasonParams{League: &league})
	home := seed.CreateTeam(testdb.TeamParams{League: &league})
	away := seed.CreateTeam(testdb.TeamParams{League: &league})
	seed.RegisterTeams(season, home, away)

	store := auth.NewPostgresStore(testPool)
	svc := auth.NewService(store, auth.EmailNotifier{Mailer: mailer.Disabled{}})
	create := func(email string, superadmin bool) {
		t.Helper()
		u, err := svc.CreateUser(t.Context(), email, "Test User", testPassword, superadmin)
		if err != nil {
			t.Fatalf("CreateUser(%s) error = %v", email, err)
		}
		if email == "admin@example.com" {
			if err := store.AddLeagueAdmin(t.Context(), u.ID, league.ID); err != nil {
				t.Fatalf("AddLeagueAdmin() error = %v", err)
			}
		}
		if email == "other@example.com" {
			if err := store.AddLeagueAdmin(t.Context(), u.ID, other.ID); err != nil {
				t.Fatalf("AddLeagueAdmin() error = %v", err)
			}
		}
	}
	create("admin@example.com", false)
	create("other@example.com", false)
	create("super@example.com", true)

	router := (&Server{db: poolService{testPool}}).RegisterRoutes()
	cookies := map[string]*http.Cookie{
		"admin of the league":     loginCookie(t, router, "admin@example.com"),
		"admin of another league": loginCookie(t, router, "other@example.com"),
		"superadmin":              loginCookie(t, router, "super@example.com"),
	}

	base := fmt.Sprintf("/api/v1/leagues/%s", league.ID)
	seasonBase := fmt.Sprintf("%s/seasons/%s", base, season.ID)
	matchBody := fmt.Sprintf(`{"home_team_id": %q, "away_team_id": %q, "matchday": 1}`, home.ID, away.ID)

	writes := []struct {
		name   string
		method string
		path   string
		body   func(who string) string
		want   int
	}{
		{"create a team", http.MethodPost, base + "/teams", func(who string) string { return fmt.Sprintf(`{"name": "Team of %s"}`, who) }, http.StatusCreated},
		{"create a player", http.MethodPost, base + "/players", func(string) string { return `{"firstname": "Jean", "lastname": "Dupont"}` }, http.StatusCreated},
		{"create a season", http.MethodPost, base + "/seasons", func(who string) string {
			if who == "superadmin" {
				return `{"name": "Season of superadmin", "start_on": "2028-08-01", "end_on": "2029-05-31", "tie_breakers": ["goal_difference"]}`
			}
			return fmt.Sprintf(`{"name": "Season of %s", "start_on": "2027-08-01", "end_on": "2028-05-31", "tie_breakers": ["goal_difference"]}`, who)
		}, http.StatusCreated},
		{"schedule a match", http.MethodPost, seasonBase + "/matches", func(who string) string {
			if who == "superadmin" {
				return strings.Replace(matchBody, `"matchday": 1`, `"matchday": 2`, 1)
			}
			return matchBody
		}, http.StatusCreated},
	}

	do := func(method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			req.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	for _, w := range writes {
		t.Run(w.name, func(t *testing.T) {
			if rec := do(w.method, w.path, w.body("anonymous"), nil); rec.Code != http.StatusUnauthorized {
				t.Errorf("anonymous: status = %d, want %d, body = %s", rec.Code, http.StatusUnauthorized, rec.Body)
			}
			if rec := do(w.method, w.path, w.body("other"), cookies["admin of another league"]); rec.Code != http.StatusForbidden {
				t.Errorf("admin of another league: status = %d, want %d, body = %s", rec.Code, http.StatusForbidden, rec.Body)
			}
			if rec := do(w.method, w.path, w.body("admin"), cookies["admin of the league"]); rec.Code != w.want {
				t.Errorf("admin of the league: status = %d, want %d, body = %s", rec.Code, w.want, rec.Body)
			}
			if rec := do(w.method, w.path, w.body("superadmin"), cookies["superadmin"]); rec.Code != w.want {
				t.Errorf("superadmin: status = %d, want %d, body = %s", rec.Code, w.want, rec.Body)
			}
		})
	}

	t.Run("reads stay public", func(t *testing.T) {
		for _, path := range []string{"/api/v1/leagues", base + "/teams", base + "/seasons", seasonBase + "/matches", seasonBase + "/standings"} {
			if rec := do(http.MethodGet, path, "", nil); rec.Code != http.StatusOK {
				t.Errorf("GET %s: status = %d, want %d", path, rec.Code, http.StatusOK)
			}
		}
	})

	t.Run("leagues are managed by the superadmin only", func(t *testing.T) {
		if rec := do(http.MethodPost, "/api/v1/leagues", `{"name": "New league"}`, nil); rec.Code != http.StatusUnauthorized {
			t.Errorf("anonymous: status = %d, want %d", rec.Code, http.StatusUnauthorized)
		}
		if rec := do(http.MethodPost, "/api/v1/leagues", `{"name": "New league"}`, cookies["admin of the league"]); rec.Code != http.StatusForbidden {
			t.Errorf("league admin: status = %d, want %d", rec.Code, http.StatusForbidden)
		}
		if rec := do(http.MethodDelete, base, "", cookies["admin of the league"]); rec.Code != http.StatusForbidden {
			t.Errorf("league admin deleting its league: status = %d, want %d", rec.Code, http.StatusForbidden)
		}
		if rec := do(http.MethodPost, "/api/v1/leagues", `{"name": "New league"}`, cookies["superadmin"]); rec.Code != http.StatusCreated {
			t.Errorf("superadmin: status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body)
		}
	})
}

func TestCORS_OnlyListedOriginsAreAllowed(t *testing.T) {
	testdb.New(t, testPool)
	router := (&Server{db: poolService{testPool}, corsOrigins: []string{"https://admin.example.com"}}).RegisterRoutes()

	tests := []struct {
		origin string
		want   string
	}{
		{"https://admin.example.com", "https://admin.example.com"},
		{"https://evil.example.com", ""},
		{"http://admin.example.com", ""},
	}
	for _, tt := range tests {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/leagues", nil)
		req.Header.Set("Origin", tt.origin)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.want {
			t.Errorf("origin %s: Access-Control-Allow-Origin = %q, want %q", tt.origin, got, tt.want)
		}
	}
}
