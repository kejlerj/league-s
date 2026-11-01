//go:build integration

package match

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"league-s/internal/db"
	"league-s/internal/testdb"
)

func TestMatchEventConstraints(t *testing.T) {
	s := testdb.New(t, testPool)
	seasonRow := s.CreateSeason(testdb.SeasonParams{})
	otherSeason := s.CreateSeason(testdb.SeasonParams{StartOn: "2026-08-01", EndOn: "2027-05-31"})
	home, away := s.CreateTeam(testdb.TeamParams{}), s.CreateTeam(testdb.TeamParams{})
	s.RegisterTeams(seasonRow, home, away)
	s.RegisterTeams(otherSeason, home)
	matchID := s.CreateMatch(testdb.MatchParams{Season: seasonRow, Home: home, Away: away, Status: db.MatchStatusLive, Score: &testdb.Score{}})
	player, other := s.CreatePlayer(testdb.PlayerParams{}), s.CreatePlayer(testdb.PlayerParams{})
	otherLeague := s.CreateLeague(testdb.LeagueParams{})
	foreigner := s.CreatePlayer(testdb.PlayerParams{League: &otherLeague})

	type row struct {
		seasonID   uuid.UUID
		typ        string
		minute     int
		playerID   *uuid.UUID
		assistID   *uuid.UUID
		playerInID *uuid.UUID
		ownGoal    bool
		penalty    bool
		note       *string
	}
	insert := func(r row) error {
		if r.seasonID == uuid.Nil {
			r.seasonID = seasonRow.ID
		}
		_, err := testPool.Exec(context.Background(),
			`INSERT INTO match_event (league_id, season_id, match_id, team_id, type, minute, player_id, assist_player_id, player_in_id, own_goal, penalty, note)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			seasonRow.LeagueID, r.seasonID, matchID, home.ID, r.typ, r.minute, r.playerID, r.assistID, r.playerInID, r.ownGoal, r.penalty, r.note)
		return err
	}

	if err := insert(row{typ: "goal", minute: 10, playerID: &player.ID, assistID: &other.ID}); err != nil {
		t.Fatalf("a valid goal: %v", err)
	}

	tests := []struct {
		name       string
		row        row
		constraint string
	}{
		{"minute 0", row{typ: "goal", minute: 0}, "match_event_minute_check"},
		{"minute 151", row{typ: "goal", minute: 151}, "match_event_minute_check"},
		{"a card marked as a penalty", row{typ: "yellow_card", minute: 5, playerID: &player.ID, penalty: true}, "match_event_goal_fields"},
		{"a card without a player", row{typ: "red_card", minute: 5}, "match_event_player_required"},
		{"an injury without a player", row{typ: "injury", minute: 5}, "match_event_player_required"},
		{"a note on a goal", row{typ: "goal", minute: 5, note: new("Cheville")}, "match_event_note"},
		{"an empty note", row{typ: "injury", minute: 5, playerID: &player.ID, note: new("")}, "match_event_note"},
		{"a substitution without a player coming in", row{typ: "substitution", minute: 5, playerID: &player.ID}, "match_event_substitution_players"},
		{"a substitution of a player by himself", row{typ: "substitution", minute: 5, playerID: &player.ID, playerInID: &player.ID}, "match_event_substitution_players"},
		{"a player coming in on a goal", row{typ: "goal", minute: 5, playerInID: &player.ID}, "match_event_substitution_players"},
		{"an assist on a penalty", row{typ: "goal", minute: 5, playerID: &player.ID, assistID: &other.ID, penalty: true}, "match_event_no_assist"},
		{"a player of another league", row{typ: "yellow_card", minute: 5, playerID: &foreigner.ID}, "match_event_player_fkey"},
		{"a match of another season", row{seasonID: otherSeason.ID, typ: "goal", minute: 5}, "match_event_match_fkey"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := insert(tt.row)
			pgErr, ok := errors.AsType[*pgconn.PgError](err)
			if !ok || pgErr.ConstraintName != tt.constraint {
				t.Errorf("insert error = %v, want a violation of %s", err, tt.constraint)
			}
		})
	}

	t.Run("a player with events cannot be deleted", func(t *testing.T) {
		_, err := testPool.Exec(context.Background(), `DELETE FROM player WHERE id = $1`, player.ID)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.ConstraintName != "match_event_player_fkey" {
			t.Errorf("delete error = %v, want a violation of match_event_player_fkey", err)
		}
	})
}
