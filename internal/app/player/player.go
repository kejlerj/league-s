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

type Club struct {
	ID   uuid.UUID
	Name string
	Logo *string
}

type Profile struct {
	Player
	CurrentTeam *Club
}

type GetError string

func (e GetError) Error() string { return string(e) }

const ErrGetNotFound GetError = "player not found"

type ListError string

func (e ListError) Error() string { return string(e) }

const ErrListLeagueNotFound ListError = "league not found"

type Update struct {
	Firstname *string
	Lastname  *string
	Icon      *string
}

type UpdateError string

func (e UpdateError) Error() string { return string(e) }

const ErrUpdateNotFound UpdateError = "player not found"

type DeleteError string

func (e DeleteError) Error() string { return string(e) }

const (
	ErrDeleteNotFound   DeleteError = "player not found"
	ErrDeleteHasHistory DeleteError = "player has been in a squad"
)
