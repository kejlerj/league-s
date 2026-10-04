package testdb

import (
	"context"
	"log"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	tclog "github.com/testcontainers/testcontainers-go/log"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
)

func Run(m *testing.M, pool **pgxpool.Pool) int {
	ctx := context.Background()

	tclog.SetDefault(tclog.NewNoopLogger())
	goose.SetLogger(goose.NopLogger())

	ctr, err := postgres.Run(ctx, "postgres:18",
		postgres.WithDatabase("test"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		postgres.BasicWaitStrategies(),
	)
	if err != nil {
		log.Fatalf("start postgres: %v", err)
	}
	defer func() { _ = ctr.Terminate(ctx) }()

	dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("connection string: %v", err)
	}

	p, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("create pool: %v", err)
	}
	defer p.Close()

	sqlDB := stdlib.OpenDBFromPool(p)
	defer func() { _ = sqlDB.Close() }()
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(sqlDB, migrationsDir()); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	*pool = p
	return m.Run()
}

func Reset(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(context.Background(),
		"TRUNCATE league RESTART IDENTITY CASCADE")
	if err != nil {
		t.Fatalf("reset db: %v", err)
	}
}

func migrationsDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", "migrations")
}
