package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service interface {
	Health(ctx context.Context) error

	Pool() *pgxpool.Pool

	Close()
}

type service struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (Service, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &service{pool: pool}, nil
}

func (s *service) Pool() *pgxpool.Pool {
	return s.pool
}

func (s *service) Health(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()

	if err := s.pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	return nil
}

func (s *service) Close() {
	log.Printf("Disconnected from database")
	s.pool.Close()
}
