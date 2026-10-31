package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"league-s/internal/config"
	"league-s/internal/database"
	"league-s/internal/demo"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("seed: %v", err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	ctx := context.Background()
	db, err := database.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("database: %w", err)
	}
	defer db.Close()

	if err := demo.Seed(ctx, db.Pool(), time.Now()); err != nil {
		return err
	}

	fmt.Printf("league   %s  %s\n", demo.LeagueID, demo.LeagueName)
	fmt.Printf("admin    %s  %s / %s\n", demo.AdminID, demo.AdminEmail, demo.AdminPassword)
	fmt.Printf("season   %s  2025-2026\n", demo.PreviousSeasonID)
	fmt.Printf("season   %s  2026-2027 (current)\n", demo.CurrentSeasonID)
	for _, t := range demo.Teams() {
		fmt.Printf("team     %s  %s\n", t.ID, t.Name)
	}
	return nil
}
