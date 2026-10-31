//go:build integration

package scenario

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/internal/app/auth"
	"league-s/internal/config"
	"league-s/internal/db"
	"league-s/internal/mailer"
	"league-s/internal/server"
)

const adminPassword = "correct horse battery"

type poolService struct{ pool *pgxpool.Pool }

func (p poolService) Health(context.Context) error { return nil }
func (p poolService) Pool() *pgxpool.Pool          { return p.pool }
func (p poolService) Close()                       {}

type admin struct {
	t      *testing.T
	router http.Handler
	cookie *http.Cookie
	league string
}

func loginAsAdminOf(t *testing.T, league db.League) *admin {
	t.Helper()
	notifier := auth.EmailNotifier{Mailer: mailer.Disabled{}}
	store := auth.NewPostgresStore(testPool)
	email := fmt.Sprintf("admin-%s@example.com", league.ID)

	user, err := auth.NewService(store, notifier).CreateUser(t.Context(), email, "League Admin", adminPassword, false)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if err := store.AddLeagueAdmin(t.Context(), user.ID, league.ID); err != nil {
		t.Fatalf("AddLeagueAdmin() error = %v", err)
	}

	a := &admin{
		t:      t,
		router: server.NewServer(config.Config{}, poolService{testPool}, notifier).Handler,
		league: "/api/v1/leagues/" + league.ID.String(),
	}
	rec := a.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": email, "password": adminPassword})
	if rec.Code != http.StatusOK {
		t.Fatalf("login: status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == auth.CookieName {
			a.cookie = c
		}
	}
	if a.cookie == nil {
		t.Fatal("login: no session cookie")
	}
	return a
}

func (a *admin) do(method, path string, body any) *httptest.ResponseRecorder {
	a.t.Helper()
	var payload bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&payload).Encode(body); err != nil {
			a.t.Fatalf("encode %s %s body: %v", method, path, err)
		}
	}

	req := httptest.NewRequestWithContext(a.t.Context(), method, path, &payload)
	req.Header.Set("Content-Type", "application/json")
	if a.cookie != nil {
		req.AddCookie(a.cookie)
	}
	rec := httptest.NewRecorder()
	a.router.ServeHTTP(rec, req)
	return rec
}

func (a *admin) send(method, path string, body any, want int, out any) {
	a.t.Helper()
	rec := a.do(method, a.league+path, body)
	if rec.Code != want {
		a.t.Fatalf("%s %s: status = %d, want %d, body = %s", method, path, rec.Code, want, rec.Body)
	}
	if out == nil {
		return
	}
	if err := json.Unmarshal(rec.Body.Bytes(), out); err != nil {
		a.t.Fatalf("%s %s: decode %s: %v", method, path, rec.Body, err)
	}
}

type created struct {
	ID uuid.UUID `json:"id"`
}

type matchResponse struct {
	ID        uuid.UUID  `json:"id"`
	Matchday  int32      `json:"matchday"`
	KickoffAt *time.Time `json:"kickoff_at"`
	Status    string     `json:"status"`
	HomeScore *int32     `json:"home_score"`
	AwayScore *int32     `json:"away_score"`
}

type standingRow struct {
	Rank           int       `json:"rank"`
	TeamID         uuid.UUID `json:"team_id"`
	Played         int32     `json:"played"`
	Won            int32     `json:"won"`
	Drawn          int32     `json:"drawn"`
	Lost           int32     `json:"lost"`
	GoalsFor       int32     `json:"goals_for"`
	GoalsAgainst   int32     `json:"goals_against"`
	GoalDifference int32     `json:"goal_difference"`
	Points         int32     `json:"points"`
}

type squadMember struct {
	MembershipID uuid.UUID `json:"membership_id"`
	PlayerID     uuid.UUID `json:"player_id"`
	Number       *int32    `json:"number"`
	JoinedOn     string    `json:"joined_on"`
	LeftOn       *string   `json:"left_on"`
}

func (a *admin) play(seasonID, matchID uuid.UUID, home, away int32) {
	a.t.Helper()
	path := fmt.Sprintf("/seasons/%s/matches/%s", seasonID, matchID)
	a.send(http.MethodPost, path+"/start", nil, http.StatusOK, nil)
	a.send(http.MethodPut, path+"/score", map[string]int32{"home": home, "away": away}, http.StatusOK, nil)
	a.send(http.MethodPost, path+"/finish", nil, http.StatusOK, nil)
}

func (a *admin) standings(seasonID uuid.UUID) []standingRow {
	a.t.Helper()
	var rows []standingRow
	a.send(http.MethodGet, fmt.Sprintf("/seasons/%s/standings", seasonID), nil, http.StatusOK, &rows)
	return rows
}

func checkStandings(t *testing.T, got, want []standingRow) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("standings have %d rows, want %d: %+v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("standings row %d = %+v, want %+v", i+1, got[i], want[i])
		}
	}
}
