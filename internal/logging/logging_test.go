package logging

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
)

func serve(t *testing.T, format string, level slog.Level, path string, handler http.HandlerFunc) string {
	t.Helper()
	var buf bytes.Buffer
	logger := New(&buf, format, level)

	h := middleware.RequestID(Requests(logger)(handler))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
	req.Header.Set(middleware.RequestIDHeader, "req-1")
	h.ServeHTTP(httptest.NewRecorder(), req)

	return buf.String()
}

func decodeLine(t *testing.T, line string) map[string]any {
	t.Helper()
	var entry map[string]any
	if err := json.Unmarshal([]byte(line), &entry); err != nil {
		t.Fatalf("log line is not JSON: %v, line = %q", err, line)
	}
	return entry
}

func TestRequests_LogsOneLinePerRequest(t *testing.T) {
	out := serve(t, FormatJSON, slog.LevelInfo, "/api/v1/leagues?token=secret", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
	})

	entry := decodeLine(t, strings.TrimSpace(out))
	switch {
	case entry["msg"] != "http request" || entry["level"] != "INFO":
		t.Errorf("msg / level = %v / %v, want http request / INFO", entry["msg"], entry["level"])
	case entry["method"] != http.MethodGet || entry["path"] != "/api/v1/leagues":
		t.Errorf("method / path = %v / %v, want GET /api/v1/leagues without the query string", entry["method"], entry["path"])
	case entry["status"] != float64(http.StatusCreated):
		t.Errorf("status = %v, want %d", entry["status"], http.StatusCreated)
	case entry["request_id"] != "req-1":
		t.Errorf("request_id = %v, want req-1", entry["request_id"])
	}
}

func TestRequests_LevelFollowsTheStatus(t *testing.T) {
	tests := []struct {
		name      string
		status    int
		wantLevel string
	}{
		{"implicit 200", 0, "INFO"},
		{"client error", http.StatusNotFound, "INFO"},
		{"server error", http.StatusInternalServerError, "ERROR"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			out := serve(t, FormatJSON, slog.LevelInfo, "/", func(w http.ResponseWriter, _ *http.Request) {
				if tt.status != 0 {
					w.WriteHeader(tt.status)
				}
			})

			if got := decodeLine(t, strings.TrimSpace(out))["level"]; got != tt.wantLevel {
				t.Errorf("level = %v, want %s", got, tt.wantLevel)
			}
		})
	}
}

func TestNew_HandlerLogsCarryTheRequestID(t *testing.T) {
	var buf bytes.Buffer
	logger := New(&buf, FormatJSON, slog.LevelInfo)

	h := middleware.RequestID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		logger.ErrorContext(r.Context(), "create player", "err", "boom")
	}))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", nil)
	req.Header.Set(middleware.RequestIDHeader, "req-2")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if got := decodeLine(t, strings.TrimSpace(buf.String()))["request_id"]; got != "req-2" {
		t.Errorf("request_id = %v, want req-2", got)
	}
}

func TestNew_LevelAndFormat(t *testing.T) {
	out := serve(t, FormatText, slog.LevelError, "/", func(http.ResponseWriter, *http.Request) {})
	if out != "" {
		t.Errorf("output = %q, want nothing: an INFO line is below the ERROR level", out)
	}

	out = serve(t, FormatText, slog.LevelInfo, "/", func(http.ResponseWriter, *http.Request) {})
	if !strings.Contains(out, `msg="http request"`) {
		t.Errorf("output = %q, want a text line", out)
	}
}
