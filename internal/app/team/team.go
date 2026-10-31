package team

import "github.com/google/uuid"

type Team struct {
	ID       uuid.UUID
	LeagueID uuid.UUID
	Name     string
	Logo     *string
}

type CreateError string

func (e CreateError) Error() string { return string(e) }

const (
	ErrCreateLeagueNotFound CreateError = "league not found"
	ErrCreateNameTaken      CreateError = "team name is already taken in this league"
)

type GetError string

func (e GetError) Error() string { return string(e) }

const ErrGetNotFound GetError = "team not found"

type ListError string

func (e ListError) Error() string { return string(e) }

const ErrListLeagueNotFound ListError = "league not found"

type Update struct {
	Name *string
	Logo *string
}

type UpdateError string

func (e UpdateError) Error() string { return string(e) }

const (
	ErrUpdateNotFound  UpdateError = "team not found"
	ErrUpdateNameTaken UpdateError = "team name is already taken in this league"
)

type DeleteError string

func (e DeleteError) Error() string { return string(e) }

const (
	ErrDeleteNotFound   DeleteError = "team not found"
	ErrDeleteHasHistory DeleteError = "team is registered in a season"
)
