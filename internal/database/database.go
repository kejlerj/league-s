package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/joho/godotenv/autoload"
)

type Service interface {
	// Health returns a map of health status information.
	// The keys and values in the map are service-specific.
	Health() map[string]string

	// Pool returns the underlying connection pool, used to build sqlc queries.
	Pool() *pgxpool.Pool

	// Close terminates all connections in the pool.
	Close()
}

type service struct {
	pool *pgxpool.Pool
}

var (
	database = os.Getenv("DB_DATABASE")
	password = os.Getenv("DB_PASSWORD")
	username = os.Getenv("DB_USERNAME")
	port     = os.Getenv("DB_PORT")
	host     = os.Getenv("DB_HOST")
	schema   = os.Getenv("DB_SCHEMA")
)

// New creates a connection pool and checks that the database is reachable.
func New(ctx context.Context) (Service, error) {
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable&search_path=%s", username, password, host, port, database, schema)

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// pgxpool.New does not open a connection, so ping to fail fast.
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &service{pool: pool}, nil
}

func (s *service) Pool() *pgxpool.Pool {
	return s.pool
}

// Health checks the health of the database connection by pinging the database.
// It returns a map with keys indicating various health statistics.
func (s *service) Health() map[string]string {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	stats := make(map[string]string)

	// Ping the database
	if err := s.pool.Ping(ctx); err != nil {
		stats["status"] = "down"
		stats["error"] = fmt.Sprintf("db down: %v", err)
		log.Printf("db down: %v", err)
		return stats
	}

	// Database is up, add more statistics
	stats["status"] = "up"
	stats["message"] = "It's healthy"

	// Get pool stats (total, acquired, idle connections, etc.)
	poolStats := s.pool.Stat()
	stats["total_conns"] = strconv.Itoa(int(poolStats.TotalConns()))
	stats["acquired_conns"] = strconv.Itoa(int(poolStats.AcquiredConns()))
	stats["idle_conns"] = strconv.Itoa(int(poolStats.IdleConns()))
	stats["max_conns"] = strconv.Itoa(int(poolStats.MaxConns()))
	stats["empty_acquire_count"] = strconv.FormatInt(poolStats.EmptyAcquireCount(), 10)
	stats["acquire_duration"] = poolStats.AcquireDuration().String()

	// Evaluate stats to provide a health message
	if poolStats.AcquiredConns() >= poolStats.MaxConns() {
		stats["message"] = "All connections are in use, requests may wait for a free connection."
	}

	return stats
}

// Close closes all connections in the pool.
// It logs a message indicating the disconnection from the specific database.
func (s *service) Close() {
	log.Printf("Disconnected from database: %s", database)
	s.pool.Close()
}
