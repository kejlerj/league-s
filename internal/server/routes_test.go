//go:build integration

package server

import (
	"context"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/internal/testdb"
	"league-s/internal/testhttp"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	os.Exit(testdb.Run(m, &testPool))
}

type poolService struct{ pool *pgxpool.Pool }

func (p poolService) Health(context.Context) error { return nil }
func (p poolService) Pool() *pgxpool.Pool          { return p.pool }
func (p poolService) Close()                       {}

func TestRoutesAreMounted(t *testing.T) {
	testdb.New(t, testPool)
	router := (&Server{db: poolService{testPool}}).RegisterRoutes()

	routes := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/v1/leagues"},
		{http.MethodGet, "/api/v1/leagues"},
		{http.MethodGet, "/api/v1/leagues/1"},
		{http.MethodDelete, "/api/v1/leagues/abc"},
		{http.MethodGet, "/api/v1/leagues/1/teams"},
		{http.MethodPost, "/api/v1/leagues/1/teams"},
		{http.MethodGet, "/api/v1/leagues/1/teams/1"},
		{http.MethodPost, "/api/v1/leagues/1/players"},
		{http.MethodGet, "/api/v1/leagues/1/players/1"},
		{http.MethodPost, "/api/v1/leagues/1/seasons"},
		{http.MethodGet, "/api/v1/leagues/1/seasons/1"},
		{http.MethodGet, "/api/v1/leagues/1/seasons/1/teams"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/teams/1"},
		{http.MethodDelete, "/api/v1/leagues/1/seasons/1/teams/1"},
		{http.MethodGet, "/api/v1/leagues/1/seasons/1/teams/1/squad"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/teams/1/squad"},
		{http.MethodPatch, "/api/v1/leagues/1/seasons/1/teams/1/squad/1"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/teams/1/squad/1/leave"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/transfers"},
		{http.MethodGet, "/api/v1/leagues/1/seasons/1/matches"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/matches"},
		{http.MethodGet, "/api/v1/leagues/1/seasons/1/matches/1"},
		{http.MethodPatch, "/api/v1/leagues/1/seasons/1/matches/1"},
		{http.MethodDelete, "/api/v1/leagues/1/seasons/1/matches/abc"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/matches/1/start"},
		{http.MethodPut, "/api/v1/leagues/1/seasons/1/matches/1/score"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/matches/1/finish"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/matches/1/postpone"},
		{http.MethodPost, "/api/v1/leagues/1/seasons/1/matches/1/cancel"},
		{http.MethodGet, "/api/v1/leagues/1/seasons/1/standings"},
	}

	for _, rt := range routes {
		t.Run(rt.method+" "+rt.path, func(t *testing.T) {
			rec := testhttp.Do(t, router, rt.method, rt.path, "{}")
			if rec.Code == http.StatusMethodNotAllowed {
				t.Fatalf("status = 405, route is not registered for %s", rt.method)
			}
			if !strings.Contains(rec.Header().Get("Content-Type"), "application/json") {
				t.Fatalf("status = %d, body = %q: request did not reach a handler", rec.Code, rec.Body)
			}
		})
	}
}
