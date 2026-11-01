package testdb

import (
	"context"
	"log"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	tclog "github.com/testcontainers/testcontainers-go/log"
	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"league-s/internal/database"
)

func Run(m *testing.M, pool **pgxpool.Pool) int {
	ctx := context.Background()

	tclog.SetDefault(tclog.NewNoopLogger())

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

	if _, err := database.Migrate(ctx, dsn); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	*pool = p
	return m.Run()
}

func Reset(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(context.Background(),
		"TRUNCATE league, app_user RESTART IDENTITY CASCADE")
	if err != nil {
		t.Fatalf("reset db: %v", err)
	}
}
