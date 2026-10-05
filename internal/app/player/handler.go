package player

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/httpx"
)

type Handler struct {
	store *PostgresStore
}

func NewHandler(store *PostgresStore) *Handler {
	return &Handler{store: store}
}

type createPlayerRequest struct {
	Firstname string  `json:"firstname" validate:"required,max=50"`
	Lastname  string  `json:"lastname" validate:"required,max=50"`
	Icon      *string `json:"icon" validate:"omitempty,http_url"`
}

type playerResponse struct {
	ID        uuid.UUID `json:"id"`
	LeagueID  uuid.UUID `json:"league_id"`
	Firstname string    `json:"firstname"`
	Lastname  string    `json:"lastname"`
	Icon      *string   `json:"icon"`
}

func toResponse(p *Player) playerResponse {
	return playerResponse{ID: p.ID, LeagueID: p.LeagueID, Firstname: p.Firstname, Lastname: p.Lastname, Icon: p.Icon}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.create)
	r.Get("/{playerID}", h.get)
	return r
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid league ID")
		return
	}

	var req createPlayerRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	player := &Player{LeagueID: leagueID, Firstname: req.Firstname, Lastname: req.Lastname, Icon: req.Icon}

	res, err := h.store.Create(r.Context(), player)
	if createErr, ok := errors.AsType[CreateError](err); ok {
		switch createErr {
		case ErrCreateLeagueNotFound:
			httpx.Error(w, http.StatusNotFound, createErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "create player", "err", err, "league_id", leagueID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusCreated, toResponse(res))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid league ID")
		return
	}
	id, err := httpx.IDParam(r, "playerID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid player ID")
		return
	}

	player, err := h.store.Get(r.Context(), leagueID, id)

	if getErr, ok := errors.AsType[GetError](err); ok {
		switch getErr {
		case ErrGetNotFound:
			httpx.Error(w, http.StatusNotFound, getErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "get player", "err", err, "league_id", leagueID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(player))
}
