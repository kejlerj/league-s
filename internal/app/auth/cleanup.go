package auth

import (
	"context"
	"log/slog"
	"time"
)

type Cleaned struct {
	Sessions       int64
	PasswordResets int64
	Invitations    int64
}

type ExpiredStore interface {
	DeleteExpired(ctx context.Context, now time.Time) (Cleaned, error)
}

type Cleaner struct {
	store ExpiredStore
	now   func() time.Time
}

func NewCleaner(store ExpiredStore) *Cleaner {
	return &Cleaner{store: store, now: time.Now}
}

func (c *Cleaner) Clean(ctx context.Context) (Cleaned, error) {
	return c.store.DeleteExpired(ctx, c.now())
}

func (c *Cleaner) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		c.cleanAndLog(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (c *Cleaner) cleanAndLog(ctx context.Context) {
	res, err := c.Clean(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "delete expired sessions, password resets and invitations", "err", err)
		return
	}
	slog.InfoContext(ctx, "deleted expired sessions, password resets and invitations",
		"sessions", res.Sessions, "password_resets", res.PasswordResets, "invitations", res.Invitations)
}
