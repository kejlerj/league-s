package season

import (
	"errors"
	"testing"
	"time"
)

func day(year int, month time.Month, d int) *time.Time {
	v := time.Date(year, month, d, 0, 0, 0, 0, time.UTC)
	return &v
}

func at(year int, month time.Month, d, hour int) *time.Time {
	v := time.Date(year, month, d, hour, 0, 0, 0, time.UTC)
	return &v
}

func TestSeason_CheckContent(t *testing.T) {
	s := Season{StartOn: *day(2025, time.August, 1), EndOn: *day(2026, time.May, 31)}

	tests := []struct {
		name    string
		content Content
		want    error
	}{
		{"empty season", Content{}, nil},
		{"memberships on the first and last days", Content{FirstSquadDay: day(2025, time.August, 1), LastSquadDay: day(2026, time.May, 31)}, nil},
		{"membership before the start", Content{FirstSquadDay: day(2025, time.July, 31), LastSquadDay: day(2025, time.December, 31)}, ErrUpdateMembershipsOutside},
		{"membership after the end", Content{FirstSquadDay: day(2025, time.August, 1), LastSquadDay: day(2026, time.June, 1)}, ErrUpdateMembershipsOutside},
		{"matches on the first day and late on the last day", Content{FirstKickoff: at(2025, time.August, 1, 0), LastKickoff: at(2026, time.May, 31, 23)}, nil},
		{"match before the start", Content{FirstKickoff: at(2025, time.July, 31, 20), LastKickoff: at(2025, time.September, 1, 20)}, ErrUpdateMatchesOutside},
		{"match the day after the end", Content{FirstKickoff: at(2025, time.September, 1, 20), LastKickoff: at(2026, time.June, 1, 0)}, ErrUpdateMatchesOutside},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := s.CheckContent(tt.content); !errors.Is(err, tt.want) {
				t.Errorf("CheckContent() = %v, want %v", err, tt.want)
			}
		})
	}
}
