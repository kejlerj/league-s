package season

import (
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
	LeagueID     uuid.UUID `json:"league_id"`
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
