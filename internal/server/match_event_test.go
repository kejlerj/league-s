//go:build integration

package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"league-s/internal/app/auth"
	"league-s/internal/db"
	"league-s/internal/mailer"
	"league-s/internal/testdb"
)

func TestMatchEvents_WritesAreForTheLeagueAdminsAndTheNoteToo(t *testing.T) {
	seed := testdb.New(t, testPool)
	league := seed.CreateLeague(testdb.LeagueParams{})
	other := seed.CreateLeague(testdb.LeagueParams{})
	season := seed.CreateSeason(testdb.SeasonParams{League: &league})
	home := seed.CreateTeam(testdb.TeamParams{League: &league})
	away := seed.CreateTeam(testdb.TeamParams{League: &league})
	seed.RegisterTeams(season, home, away)
	player := seed.CreatePlayer(testdb.PlayerParams{League: &league})
	seed.CreateSquadMember(testdb.SquadMemberParams{Season: season, Team: home, Player: player})
	matchID := seed.CreateMatch(testdb.MatchParams{Season: season, Home: home, Away: away, Status: db.MatchStatusLive, Score: &testdb.Score{}})

	store := auth.NewPostgresStore(testPool)
	svc := auth.NewService(store, auth.EmailNotifier{Mailer: mailer.Disabled{}})
	for email, adminOf := range map[string]db.League{"admin@example.com": league, "other@example.com": other} {
		u, err := svc.CreateUser(t.Context(), email, "Test User", testPassword, false)
		if err != nil {
			t.Fatalf("CreateUser(%s) error = %v", email, err)
		}
		if err := store.AddLeagueAdmin(t.Context(), u.ID, adminOf.ID); err != nil {
			t.Fatalf("AddLeagueAdmin() error = %v", err)
		}
	}

	router := (&Server{db: poolService{testPool}}).RegisterRoutes()
	admin := loginCookie(t, router, "admin@example.com")
	otherAdmin := loginCookie(t, router, "other@example.com")

	path := fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/matches/%s/events", league.ID, season.ID, matchID)
	body := fmt.Sprintf(`{"type": "injury", "team_id": %q, "minute": 71, "player_id": %q, "note": "Cheville"}`, home.ID, player.ID)

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

	if rec := do(http.MethodPost, path, body, nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("anonymous POST: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	if rec := do(http.MethodPost, path, body, otherAdmin); rec.Code != http.StatusForbidden {
		t.Errorf("admin of another league POST: status = %d, want %d", rec.Code, http.StatusForbidden)
	}
	rec := do(http.MethodPost, path, body, admin)
	if rec.Code != http.StatusCreated {
		t.Fatalf("admin POST: status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body)
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if rec := do(http.MethodDelete, path+"/"+created.ID, "", nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("anonymous DELETE: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	if rec := do(http.MethodDelete, path+"/"+created.ID, "", otherAdmin); rec.Code != http.StatusForbidden {
		t.Errorf("admin of another league DELETE: status = %d, want %d", rec.Code, http.StatusForbidden)
	}

	readers := []struct {
		name     string
		cookie   *http.Cookie
		wantNote bool
	}{
		{"anonymous", nil, false},
		{"admin of another league", otherAdmin, false},
		{"unknown session", &http.Cookie{Name: auth.CookieName, Value: "not-a-session"}, false},
		{"admin of the league", admin, true},
	}
	for _, rd := range readers {
		t.Run("note for "+rd.name, func(t *testing.T) {
			rec := do(http.MethodGet, path, "", rd.cookie)
			if rec.Code != http.StatusOK {
				t.Fatalf("GET: status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
			}
			var events []struct {
				Note *string `json:"note"`
			}
			if err := json.NewDecoder(rec.Body).Decode(&events); err != nil || len(events) != 1 {
				t.Fatalf("events = %v (%v), want one", events, err)
			}
			if got := events[0].Note != nil && *events[0].Note == "Cheville"; got != rd.wantNote {
				t.Errorf("note = %v, want shown = %v", events[0].Note, rd.wantNote)
			}
			if rd.wantNote && rec.Header().Get("Cache-Control") != "no-store" {
				t.Errorf("Cache-Control = %q, want no-store on an admin's read", rec.Header().Get("Cache-Control"))
			}
		})
	}

	if rec := do(http.MethodDelete, path+"/"+created.ID, "", admin); rec.Code != http.StatusNoContent {
		t.Errorf("admin DELETE: status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body)
	}
}
