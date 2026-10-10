package logging

import (
	"context"
	"log/slog"

	"github.com/getsentry/sentry-go"
)

func sentryOptions(dsn, environment string) sentry.ClientOptions {
	off := &sentry.KeyValueCollectionBehavior{Mode: sentry.CollectionOff}

	return sentry.ClientOptions{
		Dsn:         dsn,
		Environment: environment,
		DataCollection: &sentry.DataCollection{
			UserInfo:    sentry.Set(false),
			Cookies:     off,
			QueryParams: off,
			HTTPBodies:  []sentry.BodyType{},
			HTTPHeaders: &sentry.HeaderCollectionConfig{
				Request: &sentry.KeyValueCollectionBehavior{
					Mode:  sentry.CollectionAllowList,
					Terms: []string{"Accept", "Content-Type", "User-Agent"},
				},
				Response: off,
			},
		},
	}
}

func InitSentry(dsn, environment string) error {
	return sentry.Init(sentryOptions(dsn, environment))
}

func reportError(ctx context.Context, r slog.Record) {
	var err error
	fields := map[string]any{"message": r.Message}

	r.Attrs(func(a slog.Attr) bool {
		value := a.Value.Resolve().Any()
		if e, ok := value.(error); ok && err == nil {
			err = e
			return true
		}
		fields[a.Key] = value
		return true
	})

	if err == nil {
		return
	}

	hub := sentry.GetHubFromContext(ctx)
	if hub == nil {
		hub = sentry.CurrentHub()
	}

	hub.WithScope(func(scope *sentry.Scope) {
		scope.SetContext("log", fields)
		hub.CaptureException(err)
	})
}
