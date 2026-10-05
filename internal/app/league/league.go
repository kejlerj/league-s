package league

import "github.com/google/uuid"

type League struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Logo *string   `json:"logo"`
}

type GetError string

func (e GetError) Error() string { return string(e) }

const ErrGetNotFound GetError = "league not found"

type DeleteError string

func (e DeleteError) Error() string { return string(e) }

const (
	ErrDeleteNotFound   DeleteError = "league not found"
	ErrDeleteHasHistory DeleteError = "league still has teams, players or seasons"
)
