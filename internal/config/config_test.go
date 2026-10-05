package config

import (
	"log/slog"
	"strings"
	"testing"
)

func setValidEnv(t *testing.T) {
	t.Helper()
	t.Setenv("PORT", "3000")
	t.Setenv("DB_HOST", "localhost")
	t.Setenv("DB_PORT", "5432")
	t.Setenv("DB_DATABASE", "league_s")
	t.Setenv("DB_USERNAME", "admin")
	t.Setenv("DB_PASSWORD", "password1234")
	t.Setenv("DB_SCHEMA", "public")
	t.Setenv("LOG_FORMAT", "")
	t.Setenv("LOG_LEVEL", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("SENTRY_DSN", "")
}

func TestLoad_ErrorTracking(t *testing.T) {
	setValidEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.SentryDSN != "" {
		t.Errorf("SentryDSN = %q, want it empty: error tracking is off by default", cfg.SentryDSN)
	}

	t.Setenv("APP_ENV", "production")
	t.Setenv("SENTRY_DSN", "https://public@sentry.invalid/1")

	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Environment != "production" || cfg.SentryDSN != "https://public@sentry.invalid/1" {
		t.Errorf("config = %s / %s, want production and the DSN", cfg.Environment, cfg.SentryDSN)
	}
}

func TestLoad_Logging(t *testing.T) {
	setValidEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.LogFormat != "json" || cfg.LogLevel != slog.LevelInfo {
		t.Errorf("defaults = %s / %s, want json / INFO", cfg.LogFormat, cfg.LogLevel)
	}

	t.Setenv("LOG_FORMAT", "text")
	t.Setenv("LOG_LEVEL", "debug")

	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.LogFormat != "text" || cfg.LogLevel != slog.LevelDebug {
		t.Errorf("config = %s / %s, want text / DEBUG", cfg.LogFormat, cfg.LogLevel)
	}
}

func TestLoad(t *testing.T) {
	setValidEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Port != 3000 {
		t.Errorf("Port = %d, want 3000", cfg.Port)
	}
	want := "postgres://admin:password1234@localhost:5432/league_s?search_path=public&sslmode=disable"
	if cfg.DatabaseURL != want {
		t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, want)
	}
}

func TestLoad_EscapesSpecialCharacters(t *testing.T) {
	setValidEnv(t)
	t.Setenv("DB_PASSWORD", "p@ss:w/rd")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if !strings.Contains(cfg.DatabaseURL, "admin:p%40ss%3Aw%2Frd@localhost") {
		t.Errorf("DatabaseURL = %q, want the password to be escaped", cfg.DatabaseURL)
	}
}

func TestLoad_DefaultSchema(t *testing.T) {
	setValidEnv(t)
	t.Setenv("DB_SCHEMA", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if !strings.Contains(cfg.DatabaseURL, "search_path=public") {
		t.Errorf("DatabaseURL = %q, want search_path=public", cfg.DatabaseURL)
	}
}

func TestLoad_Errors(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		value   string
		wantErr string
	}{
		{"missing port", "PORT", "", "PORT is required"},
		{"port is not a number", "PORT", "abc", "PORT must be a number"},
		{"port out of range", "PORT", "70000", "PORT must be a number"},
		{"missing host", "DB_HOST", "", "DB_HOST is required"},
		{"missing database port", "DB_PORT", "", "DB_PORT is required"},
		{"missing database name", "DB_DATABASE", "", "DB_DATABASE is required"},
		{"missing username", "DB_USERNAME", "", "DB_USERNAME is required"},
		{"missing password", "DB_PASSWORD", "", "DB_PASSWORD is required"},
		{"unknown log format", "LOG_FORMAT", "xml", "LOG_FORMAT must be json or text"},
		{"unknown log level", "LOG_LEVEL", "loud", "LOG_LEVEL must be debug, info, warn or error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setValidEnv(t)
			t.Setenv(tt.key, tt.value)

			_, err := Load()
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("Load() error = %v, want it to contain %q", err, tt.wantErr)
			}
		})
	}
}

func TestLoad_ReportsEveryMissingVariable(t *testing.T) {
	setValidEnv(t)
	t.Setenv("DB_HOST", "")
	t.Setenv("DB_PASSWORD", "")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() error = nil, want an error")
	}
	for _, want := range []string{"DB_HOST is required", "DB_PASSWORD is required"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("Load() error = %v, want it to contain %q", err, want)
		}
	}
}
