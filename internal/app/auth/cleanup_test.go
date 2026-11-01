//go:build integration

package auth

import (
	"testing"
	"time"

	"league-s/internal/testdb"
)

func TestDeleteExpired_DeletesDeadRowsAndKeepsTheOthers(t *testing.T) {
	seed := testdb.New(t, testPool)
	league := seed.CreateLeague(testdb.LeagueParams{Name: "Bears League"})
	store := NewPostgresStore(testPool)
	ctx := t.Context()
	now := time.Date(2026, time.November, 1, 12, 0, 0, 0, time.UTC)

	user, err := store.CreateUser(ctx, User{Email: "admin@example.com", Name: "Admin"}, nil)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := testPool.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("exec %q: %v", sql, err)
		}
	}
	session := func(token string, expiresAt time.Time) {
		exec(`INSERT INTO session (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, user.ID, []byte(token), expiresAt)
	}
	reset := func(token string, expiresAt time.Time, usedAt *time.Time) {
		exec(`INSERT INTO password_reset (user_id, token_hash, expires_at, used_at) VALUES ($1, $2, $3, $4)`, user.ID, []byte(token), expiresAt, usedAt)
	}
	invitation := func(email string, expiresAt time.Time, acceptedAt *time.Time) {
		exec(`INSERT INTO invitation (league_id, email, token_hash, expires_at, accepted_at) VALUES ($1, $2, $3, $4, $5)`, league.ID, email, []byte(email), expiresAt, acceptedAt)
	}
	before, after := now.Add(-time.Minute), now.Add(time.Minute)

	session("expired", before)
	session("expires now", now)
	session("valid", after)
	reset("expired", before, nil)
	reset("used", after, &before)
	reset("valid", after, nil)
	invitation("expired@example.com", before, nil)
	invitation("pending@example.com", after, nil)
	invitation("accepted@example.com", before, &before)

	got, err := store.DeleteExpired(ctx, now)
	if err != nil {
		t.Fatalf("DeleteExpired() error = %v", err)
	}
	if want := (Cleaned{Sessions: 2, PasswordResets: 2, Invitations: 1}); got != want {
		t.Errorf("DeleteExpired() = %+v, want %+v", got, want)
	}

	remaining := func(sql string) []string {
		t.Helper()
		rows, err := testPool.Query(ctx, sql)
		if err != nil {
			t.Fatalf("query %q: %v", sql, err)
		}
		defer rows.Close()
		var keys []string
		for rows.Next() {
			var key string
			if err := rows.Scan(&key); err != nil {
				t.Fatalf("scan: %v", err)
			}
			keys = append(keys, key)
		}
		return keys
	}
	check := func(table string, got, want []string) {
		t.Helper()
		if len(got) != len(want) {
			t.Errorf("%s left = %v, want %v", table, got, want)
			return
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("%s left = %v, want %v", table, got, want)
				return
			}
		}
	}
	check("sessions", remaining(`SELECT convert_from(token_hash, 'UTF8') FROM session ORDER BY 1`), []string{"valid"})
	check("password resets", remaining(`SELECT convert_from(token_hash, 'UTF8') FROM password_reset ORDER BY 1`), []string{"valid"})
	check("invitations", remaining(`SELECT email FROM invitation ORDER BY 1`), []string{"accepted@example.com", "pending@example.com"})
}
