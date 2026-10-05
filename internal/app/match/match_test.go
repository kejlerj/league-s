package match

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

var allStatuses = []Status{StatusScheduled, StatusLive, StatusFinished, StatusPostponed, StatusCancelled}

func matchIn(status Status) *Match {
	m := &Match{
		id:         uuid.New(),
		seasonID:   uuid.New(),
		homeTeamID: uuid.New(),
		awayTeamID: uuid.New(),
		matchday:   1,
		status:     status,
	}
	if status == StatusLive || status == StatusFinished {
		m.score = &Score{}
	}
	return m
}

func TestNew(t *testing.T) {
	home, away := uuid.New(), uuid.New()

	m, err := New(uuid.New(), home, away, 3, nil)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if m.Status() != StatusScheduled || m.Score() != nil || m.Matchday() != 3 {
		t.Errorf("match = %+v, want scheduled on matchday 3 without a score", m)
	}

	if _, err := New(uuid.New(), home, home, 3, nil); !errors.Is(err, ErrNewSameTeams) {
		t.Errorf("same team twice: error = %v, want ErrNewSameTeams", err)
	}
	if _, err := New(uuid.New(), home, away, 0, nil); !errors.Is(err, ErrNewInvalidMatchday) {
		t.Errorf("matchday 0: error = %v, want ErrNewInvalidMatchday", err)
	}
}

func TestTransitions(t *testing.T) {
	kickoff := time.Date(2025, time.October, 4, 18, 0, 0, 0, time.UTC)

	tests := []struct {
		name    string
		apply   func(m *Match) error
		allowed map[Status]Status
		wantErr error
	}{
		{
			name:    "Start",
			apply:   (*Match).Start,
			allowed: map[Status]Status{StatusScheduled: StatusLive},
			wantErr: ErrStartNotScheduled,
		},
		{
			name:    "SetScore",
			apply:   func(m *Match) error { return m.SetScore(2, 1) },
			allowed: map[Status]Status{StatusLive: StatusLive},
			wantErr: ErrSetScoreNotLive,
		},
		{
			name:    "Finish",
			apply:   (*Match).Finish,
			allowed: map[Status]Status{StatusLive: StatusFinished},
			wantErr: ErrFinishNotLive,
		},
		{
			name:    "Postpone",
			apply:   (*Match).Postpone,
			allowed: map[Status]Status{StatusScheduled: StatusPostponed},
			wantErr: ErrPostponeNotScheduled,
		},
		{
			name:    "Reschedule with a kickoff",
			apply:   func(m *Match) error { return m.Reschedule(2, &kickoff) },
			allowed: map[Status]Status{StatusScheduled: StatusScheduled, StatusPostponed: StatusScheduled},
			wantErr: ErrRescheduleNotPending,
		},
		{
			name:    "Reschedule without a kickoff",
			apply:   func(m *Match) error { return m.Reschedule(2, nil) },
			allowed: map[Status]Status{StatusScheduled: StatusScheduled, StatusPostponed: StatusPostponed},
			wantErr: ErrRescheduleNotPending,
		},
		{
			name:    "Cancel",
			apply:   (*Match).Cancel,
			allowed: map[Status]Status{StatusScheduled: StatusCancelled, StatusPostponed: StatusCancelled},
			wantErr: ErrCancelNotPending,
		},
		{
			name:    "CheckDeletable",
			apply:   (*Match).CheckDeletable,
			allowed: map[Status]Status{StatusScheduled: StatusScheduled},
			wantErr: ErrDeleteNotScheduled,
		},
	}

	for _, tt := range tests {
		for _, from := range allStatuses {
			t.Run(tt.name+" from "+string(from), func(t *testing.T) {
				m := matchIn(from)
				err := tt.apply(m)

				want, ok := tt.allowed[from]
				if !ok {
					if !errors.Is(err, tt.wantErr) {
						t.Errorf("error = %v, want %v", err, tt.wantErr)
					}
					if m.Status() != from {
						t.Errorf("status = %s, want it unchanged (%s) after a refused transition", m.Status(), from)
					}
					return
				}
				if err != nil {
					t.Fatalf("error = %v, want the transition allowed", err)
				}
				if m.Status() != want {
					t.Errorf("status = %s, want %s", m.Status(), want)
				}
			})
		}
	}
}

func TestStart_SetsTheScoreToZero(t *testing.T) {
	m := matchIn(StatusScheduled)
	if err := m.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if score := m.Score(); score == nil || *score != (Score{}) {
		t.Errorf("score = %v, want 0-0", score)
	}
}

func TestSetScore(t *testing.T) {
	m := matchIn(StatusLive)

	if err := m.SetScore(-1, 0); !errors.Is(err, ErrSetScoreNegative) {
		t.Errorf("negative score: error = %v, want ErrSetScoreNegative", err)
	}
	if err := m.SetScore(2, 1); err != nil {
		t.Fatalf("SetScore() error = %v", err)
	}
	if score := m.Score(); score == nil || *score != (Score{Home: 2, Away: 1}) {
		t.Errorf("score = %v, want 2-1", score)
	}
}

func TestPostpone_ClearsTheKickoff(t *testing.T) {
	m := matchIn(StatusScheduled)
	m.kickoffAt = new(time.Date(2025, time.October, 4, 18, 0, 0, 0, time.UTC))

	if err := m.Postpone(); err != nil {
		t.Fatalf("Postpone() error = %v", err)
	}
	if m.KickoffAt() != nil {
		t.Errorf("kickoff = %v, want it cleared", m.KickoffAt())
	}
}

func TestReschedule_InvalidMatchday(t *testing.T) {
	m := matchIn(StatusScheduled)
	if err := m.Reschedule(0, nil); !errors.Is(err, ErrRescheduleInvalidMatchday) {
		t.Errorf("error = %v, want ErrRescheduleInvalidMatchday", err)
	}
	if m.Matchday() != 1 {
		t.Errorf("matchday = %d, want it unchanged", m.Matchday())
	}
}

func TestScore_ReturnsACopy(t *testing.T) {
	m := matchIn(StatusLive)
	m.Score().Home = 9

	if got := m.Score().Home; got != 0 {
		t.Errorf("home score = %d, want 0: the score must only change through SetScore", got)
	}
}

func TestWinner(t *testing.T) {
	tests := []struct {
		name       string
		home, away int32
		wantHome   bool
		wantAway   bool
		wantDraw   bool
	}{
		{"home win", 2, 1, true, false, false},
		{"away win", 0, 3, false, true, false},
		{"draw", 1, 1, false, false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := matchIn(StatusFinished)
			m.score = &Score{Home: tt.home, Away: tt.away}

			winner, draw, err := m.Winner()
			if err != nil {
				t.Fatalf("Winner() error = %v", err)
			}
			switch {
			case draw != tt.wantDraw:
				t.Errorf("draw = %t, want %t", draw, tt.wantDraw)
			case tt.wantHome && winner != m.HomeTeamID():
				t.Errorf("winner = %s, want the home team", winner)
			case tt.wantAway && winner != m.AwayTeamID():
				t.Errorf("winner = %s, want the away team", winner)
			case tt.wantDraw && winner != uuid.Nil:
				t.Errorf("winner = %s, want none on a draw", winner)
			}
		})
	}

	for _, status := range []Status{StatusScheduled, StatusLive, StatusPostponed, StatusCancelled} {
		if _, _, err := matchIn(status).Winner(); !errors.Is(err, ErrWinnerNotFinished) {
			t.Errorf("Winner() on a %s match: error = %v, want ErrWinnerNotFinished", status, err)
		}
	}
}

func TestSeason_Contains(t *testing.T) {
	season := Season{
		StartOn: time.Date(2025, time.August, 1, 0, 0, 0, 0, time.UTC),
		EndOn:   time.Date(2026, time.May, 31, 0, 0, 0, 0, time.UTC),
	}

	tests := []struct {
		name    string
		kickoff time.Time
		want    bool
	}{
		{"first day", time.Date(2025, time.August, 1, 0, 0, 0, 0, time.UTC), true},
		{"during the season", time.Date(2025, time.October, 4, 18, 0, 0, 0, time.UTC), true},
		{"last day in the evening", time.Date(2026, time.May, 31, 21, 0, 0, 0, time.UTC), true},
		{"the day before", time.Date(2025, time.July, 31, 23, 59, 0, 0, time.UTC), false},
		{"the day after", time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := season.Contains(tt.kickoff); got != tt.want {
				t.Errorf("Contains(%s) = %t, want %t", tt.kickoff, got, tt.want)
			}
		})
	}
}
