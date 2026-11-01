package main

import (
	"context"
	"log/slog"
	"os"

	"league-s/internal/config"
	"league-s/internal/database"
	"league-s/internal/logging"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}
	slog.SetDefault(logging.New(os.Stdout, cfg.LogFormat, cfg.LogLevel))

	applied, err := database.Migrate(context.Background(), cfg.DatabaseURL)
	if err != nil {
		slog.Error("migrate", "err", err)
		os.Exit(1)
	}
	for _, file := range applied {
		slog.Info("migration applied", "file", file)
	}
	slog.Info("database is up to date", "applied", len(applied))
}
