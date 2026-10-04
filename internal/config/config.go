package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"

	_ "github.com/joho/godotenv/autoload"
)

type Config struct {
	Port        int
	DatabaseURL string
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

	return Config{Port: port, DatabaseURL: dsn.String()}, nil
}
