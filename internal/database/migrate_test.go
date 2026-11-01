//go:build integration

package database

import (
	"context"
	"io/fs"
	"net/url"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/migrations"
)

func freshDatabase(t *testing.T, name string) string {
	t.Helper()
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer admin.Close()
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	u, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	u.Path = "/" + name
	return u.String()
}

func TestMigrate_AppliesEveryMigrationOnAnEmptyDatabase(t *testing.T) {
	dsn := freshDatabase(t, "migrate_empty")
	files, err := fs.Glob(migrations.FS, "*.sql")
	if err != nil || len(files) == 0 {
		t.Fatalf("embedded migrations = %v, err = %v", files, err)
	}

	applied, err := Migrate(context.Background(), dsn)
	if err != nil {
		t.Fatalf("Migrate() error = %v", err)
	}
	if len(applied) != len(files) {
		t.Errorf("applied %d migrations, want %d", len(applied), len(files))
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	var exists bool
	if err := pool.QueryRow(context.Background(), "SELECT to_regclass('public.match') IS NOT NULL").Scan(&exists); err != nil || !exists {
		t.Errorf("match table exists = %v, err = %v", exists, err)
	}
}

func TestMigrate_IsANoOpOnAnUpToDateDatabase(t *testing.T) {
	dsn := freshDatabase(t, "migrate_twice")
	if _, err := Migrate(context.Background(), dsn); err != nil {
		t.Fatalf("first Migrate() error = %v", err)
	}

	applied, err := Migrate(context.Background(), dsn)
	if err != nil {
		t.Fatalf("second Migrate() error = %v", err)
	}
	if len(applied) != 0 {
		t.Errorf("applied = %v, want none", applied)
	}
}
