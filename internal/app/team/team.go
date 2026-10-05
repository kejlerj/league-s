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
