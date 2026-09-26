package team

import "errors"

type Team struct {
	ID   int64
	Name string
	Logo *string
}

var ErrNotFound = errors.New("team not found")
