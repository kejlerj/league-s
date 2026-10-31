package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getsentry/sentry-go"
)

type panickingDB struct{ noDB }

func (panickingDB) Health(context.Context) error { panic("database driver bug") }

func TestPanicsAreReportedThenRecovered(t *testing.T) {
	transport := &sentry.MockTransport{}
	client, err := sentry.NewClient(sentry.ClientOptions{Dsn: "https://public@sentry.invalid/1", Transport: transport})
	if err != nil {
		t.Fatalf("sentry.NewClient() error = %v", err)
	}
	hub := sentry.CurrentHub()
	previous := hub.Client()
	hub.BindClient(client)
	t.Cleanup(func() { hub.BindClient(previous) })

	router := (&Server{db: panickingDB{}}).RegisterRoutes()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d from the Recoverer", rec.Code, http.StatusInternalServerError)
	}
	if got := rec.Header().Get("Content-Security-Policy"); got != "default-src 'none'; frame-ancestors 'none'" {
		t.Errorf("Content-Security-Policy = %q, want the API policy", got)
	}

	events := transport.Events()
	if len(events) != 1 {
		t.Fatalf("got %d events, want the panic reported once", len(events))
	}
	raw, err := json.Marshal(events[0])
	if err != nil {
		t.Fatalf("marshal event: %v", err)
	}
	if !strings.Contains(string(raw), "database driver bug") {
		t.Errorf("event = %s, want the panic message", raw)
	}
}
