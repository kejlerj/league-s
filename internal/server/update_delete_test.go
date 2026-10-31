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

func TestUpdateAndDelete(t *testing.T) {
	seed := testdb.New(t, testPool)
	league := seed.CreateLeague(testdb.LeagueParams{Name: "Bears League"})
	other := seed.CreateLeague(testdb.LeagueParams{Name: "Other League"})

	bears := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "Bears"})
	wolves := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "Wolves"})
	idle := seed.CreateTeam(testdb.TeamParams{League: &league, Name: "Idle"})
	foreign := seed.CreateTeam(testdb.TeamParams{League: &other, Name: "Foreign"})
	foreignPlayer := seed.CreatePlayer(testdb.PlayerParams{League: &other, Firstname: "Ana", Lastname: "Foreign"})
	foreignSeason := seed.CreateSeason(testdb.SeasonParams{League: &other, Name: "Foreign season"})

	played := seed.CreateSeason(testdb.SeasonParams{League: &league, Name: "2026-2027", StartOn: "2026-08-01", EndOn: "2027-05-31"})
	empty := seed.CreateSeason(testdb.SeasonParams{League: &league, Name: "2027-2028", StartOn: "2027-08-01", EndOn: "2028-05-31"})
	seed.RegisterTeams(played, bears, wolves)
	seed.RegisterTeams(empty, bears)
	seed.CreateMatch(testdb.MatchParams{Season: played, Home: bears, Away: wolves, Matchday: 1})

	member := seed.CreatePlayer(testdb.PlayerParams{League: &league, Firstname: "Jean", Lastname: "Dupont"})
	free := seed.CreatePlayer(testdb.PlayerParams{League: &league, Firstname: "Paul", Lastname: "Martin"})

	store := auth.NewPostgresStore(testPool)
	svc := auth.NewService(store, auth.EmailNotifier{Mailer: mailer.Disabled{}})
	if _, err := svc.CreateUser(t.Context(), "super@example.com", "Super", testPassword, true); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	admin, err := svc.CreateUser(t.Context(), "admin@example.com", "Admin", testPassword, false)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if err := store.AddLeagueAdmin(t.Context(), admin.ID, league.ID); err != nil {
		t.Fatalf("AddLeagueAdmin() error = %v", err)
	}

	router := (&Server{db: poolService{testPool}}).RegisterRoutes()
	superCookie := loginCookie(t, router, "super@example.com")
	adminCookie := loginCookie(t, router, "admin@example.com")

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

	base := fmt.Sprintf("/api/v1/leagues/%s", league.ID)
	otherBase := fmt.Sprintf("/api/v1/leagues/%s", other.ID)

	join := fmt.Sprintf(`{"player_id": %q, "joined_on": "2026-09-01"}`, member.ID)
	rec := do(http.MethodPost, fmt.Sprintf("%s/seasons/%s/teams/%s/squad", base, played.ID, bears.ID), join, superCookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("join squad: status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body)
	}

	tests := []struct {
		name     string
		method   string
		path     string
		body     string
		cookie   *http.Cookie
		want     int
		wantBody string
	}{
		{"league: anonymous", http.MethodPatch, base, `{"name": "Renamed"}`, nil, http.StatusUnauthorized, ""},
		{"league: admin of the league renames it", http.MethodPatch, base, `{"name": "Bears League 2"}`, adminCookie, http.StatusOK, `"name":"Bears League 2"`},
		{"league: admin of another league", http.MethodPatch, otherBase, `{"name": "Renamed"}`, adminCookie, http.StatusForbidden, ""},
		{"league: logo only keeps the name", http.MethodPatch, base, `{"logo": "https://example.com/l.png"}`, superCookie, http.StatusOK, `"name":"Bears League 2"`},
		{"league: empty body changes nothing", http.MethodPatch, base, `{}`, superCookie, http.StatusOK, `"logo":"https://example.com/l.png"`},
		{"league: empty name", http.MethodPatch, base, `{"name": ""}`, superCookie, http.StatusUnprocessableEntity, ""},
		{"league: unknown", http.MethodPatch, "/api/v1/leagues/01a10d58-8ae3-7c66-ac38-c7cac896cc65", `{"name": "X"}`, superCookie, http.StatusNotFound, ""},
		{"league: read stays public", http.MethodGet, base, "", nil, http.StatusOK, `"name":"Bears League 2"`},
		{"league: list stays public", http.MethodGet, "/api/v1/leagues", "", nil, http.StatusOK, "Other League"},
		{"league: admin cannot delete it", http.MethodDelete, base, "", adminCookie, http.StatusForbidden, ""},

		{"team: rename", http.MethodPatch, base + "/teams/" + idle.ID.String(), `{"name": "Lions"}`, adminCookie, http.StatusOK, `"name":"Lions"`},
		{"team: name taken", http.MethodPatch, base + "/teams/" + idle.ID.String(), `{"name": "Wolves"}`, adminCookie, http.StatusConflict, ""},
		{"team: of another league", http.MethodPatch, base + "/teams/" + foreign.ID.String(), `{"name": "Stolen"}`, adminCookie, http.StatusNotFound, ""},
		{"team: javascript logo", http.MethodPatch, base + "/teams/" + idle.ID.String(), `{"logo": "javascript:alert(1)"}`, adminCookie, http.StatusUnprocessableEntity, ""},
		{"team: registered in a season", http.MethodDelete, base + "/teams/" + bears.ID.String(), "", adminCookie, http.StatusConflict, ""},
		{"team: anonymous delete", http.MethodDelete, base + "/teams/" + idle.ID.String(), "", nil, http.StatusUnauthorized, ""},
		{"team: delete", http.MethodDelete, base + "/teams/" + idle.ID.String(), "", adminCookie, http.StatusNoContent, ""},
		{"team: delete twice", http.MethodDelete, base + "/teams/" + idle.ID.String(), "", adminCookie, http.StatusNotFound, ""},
		{"team: delete through another league", http.MethodDelete, otherBase + "/teams/" + wolves.ID.String(), "", superCookie, http.StatusNotFound, ""},

		{"player: rename", http.MethodPatch, base + "/players/" + free.ID.String(), `{"lastname": "Durand"}`, adminCookie, http.StatusOK, `"firstname":"Paul","lastname":"Durand"`},
		{"player: unknown field", http.MethodPatch, base + "/players/" + free.ID.String(), `{"position": "goalkeeper"}`, adminCookie, http.StatusBadRequest, ""},
		{"player: has been in a squad", http.MethodDelete, base + "/players/" + member.ID.String(), "", adminCookie, http.StatusConflict, ""},
		{"player: of another league", http.MethodPatch, base + "/players/" + foreignPlayer.ID.String(), `{"lastname": "Stolen"}`, adminCookie, http.StatusNotFound, ""},
		{"player: delete through another league", http.MethodDelete, otherBase + "/players/" + free.ID.String(), "", superCookie, http.StatusNotFound, ""},
		{"player: empty first name", http.MethodPatch, base + "/players/" + free.ID.String(), `{"firstname": ""}`, adminCookie, http.StatusUnprocessableEntity, ""},
		{"player: delete", http.MethodDelete, base + "/players/" + free.ID.String(), "", adminCookie, http.StatusNoContent, ""},
		{"player: update after delete", http.MethodPatch, base + "/players/" + free.ID.String(), `{"lastname": "X"}`, adminCookie, http.StatusNotFound, ""},

		{"season: rename and change points", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"name": "Next", "match_win_pts": 2}`, adminCookie, http.StatusOK, `"match_win_pts":2`},
		{"season: name taken", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"name": "2026-2027"}`, adminCookie, http.StatusConflict, ""},
		{"season: end before start", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"end_on": "2027-01-01"}`, adminCookie, http.StatusUnprocessableEntity, `{"errors":{"end_on":"doit être après start_on"}}`},
		{"season: unknown tie breaker", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"tie_breakers": ["coin"]}`, adminCookie, http.StatusUnprocessableEntity, ""},
		{"season: tie breakers", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"tie_breakers": ["head_to_head"]}`, adminCookie, http.StatusOK, `"tie_breakers":["head_to_head"]`},
		{"season: start after end", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"start_on": "2028-06-01"}`, adminCookie, http.StatusUnprocessableEntity, `{"errors":{"end_on":"doit être après start_on"}}`},
		{"season: date with a time", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"start_on": "2027-08-01T00:00:00Z"}`, adminCookie, http.StatusUnprocessableEntity, `"start_on":"doit être une date au format AAAA-MM-JJ"`},
		{"season: move the dates", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"start_on": "2027-07-15", "end_on": "2028-06-15"}`, adminCookie, http.StatusOK, `"start_on":"2027-07-15","end_on":"2028-06-15"`},
		{"season: empty tie breakers", http.MethodPatch, base + "/seasons/" + empty.ID.String(), `{"tie_breakers": []}`, adminCookie, http.StatusUnprocessableEntity, ""},
		{"season: refused patch changed nothing", http.MethodGet, base + "/seasons/" + empty.ID.String(), "", nil, http.StatusOK, `"tie_breakers":["head_to_head"]`},
		{"season: of another league", http.MethodPatch, base + "/seasons/" + foreignSeason.ID.String(), `{"name": "Stolen"}`, adminCookie, http.StatusNotFound, ""},
		{"season: delete through another league", http.MethodDelete, otherBase + "/seasons/" + empty.ID.String(), "", superCookie, http.StatusNotFound, ""},
		{"season: anonymous delete", http.MethodDelete, base + "/seasons/" + empty.ID.String(), "", nil, http.StatusUnauthorized, ""},
		{"season: has matches", http.MethodDelete, base + "/seasons/" + played.ID.String(), "", adminCookie, http.StatusConflict, ""},
		{"season: delete, registrations included", http.MethodDelete, base + "/seasons/" + empty.ID.String(), "", adminCookie, http.StatusNoContent, ""},
		{"season: delete twice", http.MethodDelete, base + "/seasons/" + empty.ID.String(), "", adminCookie, http.StatusNotFound, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(tt.method, tt.path, tt.body, tt.cookie)
			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body)
			}
			if tt.wantBody != "" && !strings.Contains(rec.Body.String(), tt.wantBody) {
				t.Errorf("body = %s, want it to contain %s", rec.Body, tt.wantBody)
			}
		})
	}
}
