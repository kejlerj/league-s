package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

type fakeExpiredStore struct {
	mu    sync.Mutex
	calls []time.Time
	fail  bool
}

func (f *fakeExpiredStore) DeleteExpired(_ context.Context, now time.Time) (Cleaned, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, now)
	if f.fail {
		return Cleaned{}, errors.New("connection refused")
	}
	return Cleaned{Sessions: 1}, nil
}

func (f *fakeExpiredStore) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func TestCleaner_RunsAtStartThenOnEveryTick(t *testing.T) {
	store := &fakeExpiredStore{}
	cleaner := NewCleaner(store)
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})

	go func() {
		cleaner.Run(ctx, time.Hour)
		close(done)
	}()

	waitFor(t, func() bool { return store.count() == 1 })
	cancel()
	<-done
	if got := store.count(); got != 1 {
		t.Errorf("calls = %d, want one at start and none before the first tick", got)
	}
}

func TestCleaner_KeepsRunningAfterAnError(t *testing.T) {
	store := &fakeExpiredStore{fail: true}
	cleaner := NewCleaner(store)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	go cleaner.Run(ctx, time.Millisecond)

	waitFor(t, func() bool { return store.count() >= 3 })
}

func TestCleaner_UsesTheCurrentTime(t *testing.T) {
	store := &fakeExpiredStore{}
	cleaner := NewCleaner(store)
	at := time.Date(2026, time.November, 1, 12, 0, 0, 0, time.UTC)
	cleaner.now = func() time.Time { return at }

	if _, err := cleaner.Clean(t.Context()); err != nil {
		t.Fatalf("Clean() error = %v", err)
	}
	if len(store.calls) != 1 || !store.calls[0].Equal(at) {
		t.Errorf("calls = %v, want one at %v", store.calls, at)
	}
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met within 2s")
		}
		time.Sleep(time.Millisecond)
	}
}
