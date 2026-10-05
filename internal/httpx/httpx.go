package httpx

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func Error(w http.ResponseWriter, status int, msg string) {
	JSON(w, status, map[string]string{"error": msg})
}

var ErrInvalidID = errors.New("id must be a UUID in its canonical 36-character form")

func IDParam(r *http.Request, name string) (uuid.UUID, error) {
	raw := chi.URLParam(r, name)
	if len(raw) != 36 {
		return uuid.Nil, ErrInvalidID
	}

	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, ErrInvalidID
	}

	return id, nil
}

func IDParams(w http.ResponseWriter, r *http.Request, names ...string) ([]uuid.UUID, bool) {
	ids := make([]uuid.UUID, len(names))
	for i, name := range names {
		id, err := IDParam(r, name)
		if err != nil {
			Error(w, http.StatusBadRequest, "invalid "+name)
			return nil, false
		}
		ids[i] = id
	}
	return ids, true
}
