package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

type healthStub struct{ err error }

func (h healthStub) Health(context.Context) error { return h.err }
func (h healthStub) Pool() *pgxpool.Pool          { return nil }
func (h healthStub) Close()                       {}

func TestHealthHandler(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantBody   string
	}{
		{"database up", nil, http.StatusOK, `{"status":"up"}`},
		{"database down", errors.New(`ping database: dial tcp 10.0.0.5:5432: password authentication failed for user "league"`), http.StatusServiceUnavailable, `{"status":"down"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Server{db: healthStub{err: tt.err}}
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)
			rec := httptest.NewRecorder()

			s.healthHandler(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if got := strings.TrimSpace(rec.Body.String()); got != tt.wantBody {
				t.Errorf("body = %s, want %s: the response must not leak database details", got, tt.wantBody)
			}
		})
	}
}
