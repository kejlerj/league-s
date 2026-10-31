package logging

import (
	"context"
	"log/slog"
	"regexp"
	"strings"

	"github.com/getsentry/sentry-go"
)

const filtered = "[Filtered]"

var tokenInURL = regexp.MustCompile(`(?i)(token=)[^&\s"'#]+`)

var secretKeys = []string{"token", "password", "secret", "authorization", "cookie"}

func scrub(s string) string {
	return tokenInURL.ReplaceAllString(s, "${1}"+filtered)
}

func isSecretKey(key string) bool {
	key = strings.ToLower(key)
	for _, secret := range secretKeys {
		if strings.Contains(key, secret) {
			return true
		}
	}
	return false
}

func scrubEvent(event *sentry.Event, _ *sentry.EventHint) *sentry.Event {
	event.Message = scrub(event.Message)
	for i := range event.Exception {
		event.Exception[i].Value = scrub(event.Exception[i].Value)
	}
	for _, fields := range event.Contexts {
		for key, value := range fields {
			if s, ok := value.(string); ok {
				fields[key] = scrub(s)
			}
		}
	}
	for _, breadcrumb := range event.Breadcrumbs {
		breadcrumb.Message = scrub(breadcrumb.Message)
	}
	if event.Request != nil {
		event.Request.URL = scrub(event.Request.URL)
		event.Request.QueryString = scrub(event.Request.QueryString)
	}
	return event
}

func sentryOptions(dsn, environment string) sentry.ClientOptions {
	off := &sentry.KeyValueCollectionBehavior{Mode: sentry.CollectionOff}

	return sentry.ClientOptions{
		Dsn:         dsn,
		Environment: environment,
		BeforeSend:  scrubEvent,
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
		if isSecretKey(a.Key) {
			value = filtered
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
