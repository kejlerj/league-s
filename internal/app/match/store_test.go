//go:build integration

package match

import (
	"errors"
	"testing"

	"league-s/internal/testdb"
)

func TestStore_WritesAreScopedToTheLeague(t *testing.T) {
	f := newFixture(t)
	store := NewPostgresStore(testPool)
	other := f.seed.CreateLeague(testdb.LeagueParams{})

	created, err := NewService(store).Schedule(t.Context(), f.season.LeagueID, f.season.ID, f.home.ID, f.away.ID, 1, nil, nil)
	if err != nil {
		t.Fatalf("Schedule() error = %v", err)
	}

	changed, err := store.Get(t.Context(), f.season.LeagueID, f.season.ID, created.ID())
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if err := changed.Cancel(); err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}

	if _, err := store.Save(t.Context(), other.ID, changed); !errors.Is(err, ErrGetNotFound) {
		t.Errorf("Save() from another league: error = %v, want ErrGetNotFound", err)
	}
	if err := store.Delete(t.Context(), other.ID, f.season.ID, created.ID()); !errors.Is(err, ErrGetNotFound) {
		t.Errorf("Delete() from another league: error = %v, want ErrGetNotFound", err)
	}

	stored, err := store.Get(t.Context(), f.season.LeagueID, f.season.ID, created.ID())
	if err != nil {
		t.Fatalf("Get() error = %v, want the match still there", err)
	}
	if stored.Status() != StatusScheduled {
		t.Errorf("status = %s, want %s: the write from another league must not apply", stored.Status(), StatusScheduled)
	}

	if _, err := store.Save(t.Context(), f.season.LeagueID, changed); err != nil {
		t.Errorf("Save() from its own league: error = %v", err)
	}
	if err := store.Delete(t.Context(), f.season.LeagueID, f.season.ID, created.ID()); err != nil {
		t.Errorf("Delete() from its own league: error = %v", err)
	}
}
