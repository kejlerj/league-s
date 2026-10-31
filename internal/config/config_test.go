package config

import (
	"log/slog"
	"slices"
	"strings"
	"testing"

	"league-s/internal/mailer"
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
	t.Setenv("CORS_ORIGINS", "")
	t.Setenv("COOKIE_SECURE", "")
	t.Setenv("SUPERADMIN_EMAIL", "")
	t.Setenv("ADMIN_URL", "")
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("SMTP_PASSWORD", "")
	t.Setenv("MAIL_FROM", "")
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

func TestLoad_SMTP(t *testing.T) {
	setValidEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.SMTP.Host != "" || cfg.SMTP.Port != 587 {
		t.Errorf("defaults = %q / %d, want no host and port 587", cfg.SMTP.Host, cfg.SMTP.Port)
	}

	t.Setenv("SMTP_HOST", "smtp.example.com")
	t.Setenv("SMTP_PORT", "2525")
	t.Setenv("SMTP_USERNAME", "user")
	t.Setenv("SMTP_PASSWORD", "secret")
	t.Setenv("MAIL_FROM", "League S <no-reply@example.com>")

	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	want := mailer.SMTPConfig{Host: "smtp.example.com", Port: 2525, Username: "user", Password: "secret", From: "League S <no-reply@example.com>"}
	if cfg.SMTP != want {
		t.Errorf("SMTP = %+v, want %+v", cfg.SMTP, want)
	}
}

func TestLoad_SMTPNeedsASender(t *testing.T) {
	setValidEnv(t)
	t.Setenv("SMTP_HOST", "smtp.example.com")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "MAIL_FROM must be an email address") {
		t.Errorf("Load() error = %v, want it to ask for MAIL_FROM", err)
	}
}

func TestLoad_Admin(t *testing.T) {
	setValidEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.SuperadminEmail != "" || cfg.AdminURL != "http://localhost:5173" {
		t.Errorf("defaults = %q / %q, want no superadmin and the local admin URL", cfg.SuperadminEmail, cfg.AdminURL)
	}

	t.Setenv("SUPERADMIN_EMAIL", "me@example.com")
	t.Setenv("ADMIN_URL", "https://admin.example.com/")

	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.SuperadminEmail != "me@example.com" || cfg.AdminURL != "https://admin.example.com" {
		t.Errorf("config = %q / %q, want the email and the URL without its trailing slash", cfg.SuperadminEmail, cfg.AdminURL)
	}
}

func TestLoad_Web(t *testing.T) {
	setValidEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(cfg.CORSOrigins) != 0 || !cfg.SecureCookie {
		t.Errorf("defaults = %v / %t, want no origin allowed and secure cookies", cfg.CORSOrigins, cfg.SecureCookie)
	}

	t.Setenv("CORS_ORIGINS", "http://localhost:5173, https://admin.example.com")
	t.Setenv("COOKIE_SECURE", "false")

	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if !slices.Equal(cfg.CORSOrigins, []string{"http://localhost:5173", "https://admin.example.com"}) || cfg.SecureCookie {
		t.Errorf("config = %v / %t, want the two origins and insecure cookies", cfg.CORSOrigins, cfg.SecureCookie)
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
		{"wildcard origin", "CORS_ORIGINS", "*", "CORS_ORIGINS must be"},
		{"origin with a path", "CORS_ORIGINS", "https://admin.example.com/app", "CORS_ORIGINS must be"},
		{"invalid cookie flag", "COOKIE_SECURE", "maybe", "COOKIE_SECURE must be true or false"},
		{"superadmin is not an email", "SUPERADMIN_EMAIL", "me", "SUPERADMIN_EMAIL must be an email address"},
		{"smtp port is not a number", "SMTP_PORT", "abc", "SMTP_PORT must be a number"},
		{"admin url without a scheme", "ADMIN_URL", "admin.example.com", "ADMIN_URL must be an http or https URL"},
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
