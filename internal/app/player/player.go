package player

import "github.com/google/uuid"

type Player struct {
	ID        uuid.UUID
	LeagueID  uuid.UUID
	Firstname string
	Lastname  string
	Icon      *string
}

type CreateError string

func (e CreateError) Error() string { return string(e) }

const ErrCreateLeagueNotFound CreateError = "league not found"

type GetError string

func (e GetError) Error() string { return string(e) }

const ErrGetNotFound GetError = "player not found"
