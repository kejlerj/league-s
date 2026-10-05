package logging

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"github.com/getsentry/sentry-go"
)

func sentryContext(t *testing.T) (context.Context, *sentry.MockTransport) {
	t.Helper()
	transport := &sentry.MockTransport{}

	client, err := sentry.NewClient(sentry.ClientOptions{
		Dsn:       "https://public@sentry.invalid/1",
		Transport: transport,
	})
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
