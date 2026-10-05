//go:build integration

package database

import (
	"context"
	"log"
	"os"
	"testing"

	tclog "github.com/testcontainers/testcontainers-go/log"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
)

var databaseURL string

func TestMain(m *testing.M) {
	os.Exit(run(m))
}

func run(m *testing.M) int {
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

	databaseURL, err = ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("connection string: %v", err)
	}

	return m.Run()
}

func mustNew(t *testing.T) Service {
	t.Helper()
	srv, err := New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("New() returned an error: %v", err)
	}
	return srv
}

func TestNew(t *testing.T) {
	srv := mustNew(t)
	defer srv.Close()

	if srv.Pool() == nil {
		t.Fatal("Pool() returned nil")
	}
}

func TestHealth(t *testing.T) {
	srv := mustNew(t)
	defer srv.Close()

	if err := srv.Health(t.Context()); err != nil {
		t.Fatalf("Health() = %v, want nil", err)
	}
}

func TestHealthDown(t *testing.T) {
	srv := mustNew(t)
	srv.Close()

	if err := srv.Health(t.Context()); err == nil {
		t.Fatal("Health() = nil, want an error once the pool is closed")
	}
}
