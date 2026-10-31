package config

import (
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/mail"
	"net/url"
	"os"
	"strconv"
	"strings"

	_ "github.com/joho/godotenv/autoload"

	"league-s/internal/mailer"
)

type Config struct {
	Port            int
	DatabaseURL     string
	LogFormat       string
	LogLevel        slog.Level
	CORSOrigins     []string
	SecureCookie    bool
	SuperadminEmail string
	AdminURL        string
	SMTP            mailer.SMTPConfig
}

func Load() (Config, error) {
	var errs []error

	required := func(key string) string {
		v := os.Getenv(key)
		if v == "" {
			errs = append(errs, fmt.Errorf("%s is required", key))
		}
		return v
	}

	rawPort := required("PORT")
	host := required("DB_HOST")
	dbPort := required("DB_PORT")
	name := required("DB_DATABASE")
	user := required("DB_USERNAME")
	password := required("DB_PASSWORD")

	schema := os.Getenv("DB_SCHEMA")
	if schema == "" {
		schema = "public"
	}

	port, err := strconv.Atoi(rawPort)
	if rawPort != "" && (err != nil || port < 1 || port > 65535) {
		errs = append(errs, fmt.Errorf("PORT must be a number between 1 and 65535, got %q", rawPort))
	}

	logFormat := os.Getenv("LOG_FORMAT")
	switch logFormat {
	case "":
		logFormat = "json"
	case "json", "text":
	default:
		errs = append(errs, fmt.Errorf("LOG_FORMAT must be json or text, got %q", logFormat))
	}

	logLevel := slog.LevelInfo
	if raw := os.Getenv("LOG_LEVEL"); raw != "" {
		if err := logLevel.UnmarshalText([]byte(raw)); err != nil {
			errs = append(errs, fmt.Errorf("LOG_LEVEL must be debug, info, warn or error, got %q", raw))
		}
	}

	var corsOrigins []string
	for raw := range strings.SplitSeq(os.Getenv("CORS_ORIGINS"), ",") {
		origin := strings.TrimSpace(raw)
		if origin == "" {
			continue
		}
		u, err := url.Parse(origin)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.Path != "" {
			errs = append(errs, fmt.Errorf("CORS_ORIGINS must be a comma-separated list of origins such as https://admin.example.com, got %q", origin))
			continue
		}
		corsOrigins = append(corsOrigins, origin)
	}

	secureCookie := true
	if raw := os.Getenv("COOKIE_SECURE"); raw != "" {
		secureCookie, err = strconv.ParseBool(raw)
		if err != nil {
			errs = append(errs, fmt.Errorf("COOKIE_SECURE must be true or false, got %q", raw))
		}
	}

	superadminEmail := strings.TrimSpace(os.Getenv("SUPERADMIN_EMAIL"))
	if superadminEmail != "" {
		if addr, err := mail.ParseAddress(superadminEmail); err != nil || addr.Address != superadminEmail {
			errs = append(errs, fmt.Errorf("SUPERADMIN_EMAIL must be an email address, got %q", superadminEmail))
		}
	}

	adminURL := strings.TrimRight(os.Getenv("ADMIN_URL"), "/")
	if adminURL == "" {
		adminURL = "http://localhost:5173"
	}
	if u, err := url.Parse(adminURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		errs = append(errs, fmt.Errorf("ADMIN_URL must be an http or https URL, got %q", adminURL))
	}

	smtp := mailer.SMTPConfig{
		Host:     os.Getenv("SMTP_HOST"),
		Port:     587,
		Username: os.Getenv("SMTP_USERNAME"),
		Password: os.Getenv("SMTP_PASSWORD"),
		From:     os.Getenv("MAIL_FROM"),
	}
	if raw := os.Getenv("SMTP_PORT"); raw != "" {
		smtp.Port, err = strconv.Atoi(raw)
		if err != nil || smtp.Port < 1 || smtp.Port > 65535 {
			errs = append(errs, fmt.Errorf("SMTP_PORT must be a number between 1 and 65535, got %q", raw))
		}
	}
	if smtp.Host != "" {
		if _, err := mail.ParseAddress(smtp.From); err != nil {
			errs = append(errs, fmt.Errorf("MAIL_FROM must be an email address when SMTP_HOST is set, got %q", smtp.From))
		}
	}

	if len(errs) > 0 {
		return Config{}, errors.Join(errs...)
	}

	dsn := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(user, password),
		Host:     net.JoinHostPort(host, dbPort),
		Path:     name,
		RawQuery: url.Values{"sslmode": {"disable"}, "search_path": {schema}}.Encode(),
	}

	return Config{
		Port:         port,
		DatabaseURL:  dsn.String(),
		LogFormat:    logFormat,
		LogLevel:     logLevel,
		CORSOrigins:  corsOrigins,
		SecureCookie: secureCookie,

		SuperadminEmail: superadminEmail,
		AdminURL:        adminURL,
		SMTP:            smtp,
	}, nil
}
