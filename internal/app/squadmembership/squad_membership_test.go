package squadmembership

import (
	"errors"
	"testing"
	"time"
)

func date(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func seasonRules(maxSize *int32) SquadRules {
	return SquadRules{
		SeasonStartOn: date(2025, time.August, 1),
		SeasonEndOn:   date(2026, time.May, 31),
		MaxSize:       maxSize,
	}
}

func TestSquadRules_CheckJoin(t *testing.T) {
	tests := []struct {
		name     string
		maxSize  *int32
		joinedOn time.Time
		active   int64
		wantErr  error
	}{
		{name: "during the season", joinedOn: date(2025, time.October, 15)},
		{name: "on the first day", joinedOn: date(2025, time.August, 1)},
		{name: "on the last day", joinedOn: date(2026, time.May, 31)},
		{name: "before the season", joinedOn: date(2025, time.July, 31), wantErr: ErrJoinOutsideSeason},
		{name: "after the season", joinedOn: date(2026, time.June, 1), wantErr: ErrJoinOutsideSeason},
		{name: "no size limit", joinedOn: date(2025, time.October, 15), active: 500},
		{name: "one place left", maxSize: new(int32(10)), joinedOn: date(2025, time.October, 15), active: 9},
		{name: "squad full", maxSize: new(int32(10)), joinedOn: date(2025, time.October, 15), active: 10, wantErr: ErrJoinSquadFull},
		{name: "date checked before size", maxSize: new(int32(10)), joinedOn: date(2026, time.June, 1), active: 10, wantErr: ErrJoinOutsideSeason},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := seasonRules(tt.maxSize).CheckJoin(tt.joinedOn, tt.active)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("CheckJoin() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestSquadRules_CheckLeave(t *testing.T) {
	tests := []struct {
		name    string
		leftOn  time.Time
		wantErr error
	}{
		{name: "during the season", leftOn: date(2025, time.December, 31)},
		{name: "on the first day", leftOn: date(2025, time.August, 1)},
		{name: "on the last day", leftOn: date(2026, time.May, 31)},
		{name: "before the season", leftOn: date(2025, time.July, 31), wantErr: ErrLeaveOutsideSeason},
		{name: "after the season", leftOn: date(2026, time.June, 1), wantErr: ErrLeaveOutsideSeason},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := seasonRules(nil).CheckLeave(tt.leftOn)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("CheckLeave() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}
