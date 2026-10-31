//go:build integration

package match

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

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

func TestDatabase_RejectsATeamPlayingItself(t *testing.T) {
	f := newFixture(t)

	_, err := testPool.Exec(t.Context(),
		`INSERT INTO match (season_id, home_team_id, away_team_id, matchday) VALUES ($1, $2, $2, 1)`,
		f.season.ID, f.home.ID)
	if err == nil {
		t.Fatal("insert with the same home and away team succeeded, want a CHECK violation")
	}
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23514" {
		t.Errorf("error = %v, want a check_violation (23514)", err)
	}
}
