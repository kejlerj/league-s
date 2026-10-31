package season

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Season struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	StartOn      time.Time `json:"start_on"`
	EndOn        time.Time `json:"end_on"`
	MatchWinPts  int32     `json:"match_win_pts"`
	MatchDrawPts int32     `json:"match_draw_pts"`
	MatchLossPts int32     `json:"match_loss_pts"`
	TieBreakers  []string  `json:"tie_breakers"`
	MaxSquadSize *int32    `json:"max_squad_size"`
	LeagueID     uuid.UUID `json:"league_id"`
}

const (
	DefaultMatchWinPts  int32 = 3
	DefaultMatchDrawPts int32 = 1
	DefaultMatchLossPts int32 = 0
)

var ErrEndNotAfterStart = errors.New("season must end after it starts")

func (s *Season) CheckDates() error {
	if !s.EndOn.After(s.StartOn) {
		return ErrEndNotAfterStart
	}
	return nil
}

func DefaultTieBreakers() []string {
	return []string{"goal_difference", "goals_scored"}
}

type CreateError string

func (e CreateError) Error() string { return string(e) }

const (
	ErrCreateLeagueNotFound CreateError = "league not found"
	ErrCreateNameTaken      CreateError = "season name is already taken"
)

type GetError string

func (e GetError) Error() string { return string(e) }

const ErrGetNotFound GetError = "season not found"

type ListError string

func (e ListError) Error() string { return string(e) }

const ErrListLeagueNotFound ListError = "league not found"

type AddTeamError string

func (e AddTeamError) Error() string { return string(e) }

const (
	ErrAddTeamNotFound       AddTeamError = "team not found"
	ErrAddTeamSeasonNotFound AddTeamError = "season not found"
	ErrAddTeamAlreadyExists  AddTeamError = "team already exists in season"
)

type RemoveTeamError string

func (e RemoveTeamError) Error() string { return string(e) }

const (
	ErrRemoveTeamNotRegistered RemoveTeamError = "team is not registered in this season"
	ErrRemoveTeamHasMatches    RemoveTeamError = "team has matches in this season"
)

type Update struct {
	Name         *string
	StartOn      *time.Time
	EndOn        *time.Time
	MatchWinPts  *int32
	MatchDrawPts *int32
	MatchLossPts *int32
	TieBreakers  []string
}

type UpdateError string

func (e UpdateError) Error() string { return string(e) }

const (
	ErrUpdateNotFound     UpdateError = "season not found"
	ErrUpdateNameTaken    UpdateError = "season name is already taken"
	ErrUpdateInvalidDates UpdateError = "end_on must be after start_on"
)

type DeleteError string

func (e DeleteError) Error() string { return string(e) }

const (
	ErrDeleteNotFound   DeleteError = "season not found"
	ErrDeleteHasMatches DeleteError = "season has matches"
)
