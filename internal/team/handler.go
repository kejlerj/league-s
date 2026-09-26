package team

import (
	"encoding/json"
	"errors"
	"league-s/internal/httpx"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	store *PostgresStore
}

func NewHandler(store *PostgresStore) *Handler {
	return &Handler{store: store}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.create)
	r.Get("/{id}", h.get)
	return r
}

type createTeamRequest struct {
	Name string  `json:"name"`
	Logo *string `json:"logo"`
}

type teamResponse struct {
	ID   int64   `json:"id"`
	Name string  `json:"name"`
	Logo *string `json:"logo"`
}

func toResponse(t *Team) teamResponse {
	return teamResponse{ID: t.ID, Name: t.Name, Logo: t.Logo}
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createTeamRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		httpx.Error(w, http.StatusBadRequest, "name is required")
		return
	}

	team := &Team{Name: req.Name, Logo: req.Logo}

	res, err := h.store.Create(r.Context(), team)
	if err != nil {
		slog.ErrorContext(r.Context(), "create team", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusCreated, toResponse(res))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.IDParam(r, "id")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	team, err := h.store.Get(r.Context(), id)
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Error(w, http.StatusNotFound, "team not found")
		return
	case err != nil:
		slog.ErrorContext(r.Context(), "get team", "err", err, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(team))
}
