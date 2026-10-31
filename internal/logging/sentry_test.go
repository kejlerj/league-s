package logging

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getsentry/sentry-go"
)

func sentryContext(t *testing.T) (context.Context, *sentry.MockTransport) {
	t.Helper()
	transport := &sentry.MockTransport{}

	opts := sentryOptions("https://public@sentry.invalid/1", "test")
	opts.Transport = transport

	client, err := sentry.NewClient(opts)
	if err != nil {
		t.Fatalf("sentry.NewClient() error = %v", err)
	}

	hub := sentry.NewHub(client, sentry.NewScope())
	return sentry.SetHubOnContext(t.Context(), hub), transport
}

func TestNew_ReportsLoggedErrors(t *testing.T) {
	ctx, transport := sentryContext(t)
	logger := New(io.Discard, FormatJSON, slog.LevelInfo)

	logger.ErrorContext(ctx, "create league", "err", errors.New("connection refused"), "league_id", "42")

	events := transport.Events()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}

	event := events[0]
	if len(event.Exception) == 0 || event.Exception[0].Value != "connection refused" {
		t.Errorf("exception = %+v, want the logged error", event.Exception)
	}

	fields := event.Contexts["log"]
	if fields["message"] != "create league" || fields["league_id"] != "42" {
		t.Errorf("log context = %v, want the message and the attributes of the log line", fields)
	}
}

func TestNew_ReportsOnlyErrorsWithACause(t *testing.T) {
	tests := []struct {
		name string
		log  func(ctx context.Context, logger *slog.Logger)
	}{
		{"below the error level", func(ctx context.Context, logger *slog.Logger) {
			logger.WarnContext(ctx, "slow query", "err", errors.New("timeout"))
		}},
		{"error level without an error", func(ctx context.Context, logger *slog.Logger) {
			logger.ErrorContext(ctx, "http request", "status", 500)
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, transport := sentryContext(t)

			tt.log(ctx, New(io.Discard, FormatJSON, slog.LevelInfo))

			if events := transport.Events(); len(events) != 0 {
				t.Errorf("got %d events, want none", len(events))
			}
		})
	}
}

func TestNew_KeepsRequestSecretsOutOfReports(t *testing.T) {
	ctx, transport := sentryContext(t)

	body := strings.NewReader(`{"name": "body-secret"}`)
	req := httptest.NewRequestWithContext(ctx, http.MethodPost, "/admin/invitation?token=query-secret", body)
	req.Header.Set("X-Forwarded-Note", "header-secret")
	req.Header.Set("Cookie", "theme=cookie-secret")
	req.Header.Set("Content-Type", "application/json")
	sentry.GetHubFromContext(ctx).Scope().SetRequest(req)
	if _, err := io.ReadAll(req.Body); err != nil {
		t.Fatalf("read body: %v", err)
	}

	New(io.Discard, FormatJSON, slog.LevelInfo).ErrorContext(ctx, "login", "err", errors.New("connection refused"))

	events := transport.Events()
	if len(events) != 1 || events[0].Request == nil {
		t.Fatalf("events = %+v, want one event carrying the request", events)
	}

	sent := events[0].Request
	if sent.Headers["Content-Type"] != "application/json" {
		t.Errorf("Content-Type header = %q, want it kept", sent.Headers["Content-Type"])
	}

	report := fmt.Sprintf("%+v", *sent)
	for _, secret := range []string{"query-secret", "header-secret", "cookie-secret", "body-secret"} {
		if strings.Contains(report, secret) {
			t.Errorf("request sent to Sentry contains %q: %s", secret, report)
		}
	}
}

func TestNew_KeepsResetAndInvitationLinksOutOfReports(t *testing.T) {
	ctx, transport := sentryContext(t)
	logger := New(io.Discard, FormatJSON, slog.LevelInfo)

	logger.ErrorContext(ctx, "send invitation email to https://admin.example.com/invitation?token=message-secret",
		"err", fmt.Errorf("smtp: rejected https://admin.example.com/reset-password?token=error-secret&lang=fr"),
		"link", "https://admin.example.com/invitation?token=attr-secret",
		"token", "bare-secret",
		"password", "password-secret",
		"user_id", "42",
	)

	events := transport.Events()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}

	raw, err := json.Marshal(events[0])
	if err != nil {
		t.Fatalf("marshal event: %v", err)
	}
	report := string(raw)
	for _, secret := range []string{"message-secret", "error-secret", "attr-secret", "bare-secret", "password-secret"} {
		if strings.Contains(report, secret) {
			t.Errorf("event sent to Sentry contains %q: %s", secret, report)
		}
	}
	for _, kept := range []string{"/reset-password?token=[Filtered]\\u0026lang=fr", "/invitation?token=[Filtered]", `"user_id":"42"`} {
		if !strings.Contains(report, kept) {
			t.Errorf("event sent to Sentry lacks %q: %s", kept, report)
		}
	}
}

func TestNew_ReportsTheRequestID(t *testing.T) {
	ctx, transport := sentryContext(t)
	ctx = context.WithValue(ctx, requestIDKey{}, "req-42")

	New(io.Discard, FormatJSON, slog.LevelInfo).ErrorContext(ctx, "list teams", "err", errors.New("connection refused"))

	events := transport.Events()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}
	if got := events[0].Contexts["log"]["request_id"]; got != "req-42" {
		t.Errorf("request_id = %v, want req-42", got)
	}
}
