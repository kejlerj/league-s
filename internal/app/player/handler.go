package player

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

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

type updatePlayerRequest struct {
	Firstname *string `json:"firstname" validate:"omitnil,min=1,max=50"`
	Lastname  *string `json:"lastname" validate:"omitnil,min=1,max=50"`
	Icon      *string `json:"icon" validate:"omitnil,http_url"`
}

type playerResponse struct {
	ID        uuid.UUID `json:"id"`
	LeagueID  uuid.UUID `json:"league_id"`
	Firstname string    `json:"firstname"`
	Lastname  string    `json:"lastname"`
	Icon      *string   `json:"icon"`
}

type clubResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Logo *string   `json:"logo"`
}

type playerDetailResponse struct {
	playerResponse
	CurrentTeam *clubResponse `json:"current_team"`
}

func toDetailResponse(p *Profile) playerDetailResponse {
	res := playerDetailResponse{playerResponse: toResponse(&p.Player)}
	if c := p.CurrentTeam; c != nil {
		res.CurrentTeam = &clubResponse{ID: c.ID, Name: c.Name, Logo: c.Logo}
	}
	return res
}

func toResponse(p *Player) playerResponse {
	return playerResponse{ID: p.ID, LeagueID: p.LeagueID, Firstname: p.Firstname, Lastname: p.Lastname, Icon: p.Icon}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.create)
	r.Get("/", h.list)
	r.Get("/{playerID}", h.get)
	r.Patch("/{playerID}", h.update)
	r.Delete("/{playerID}", h.delete)
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

	profile, err := h.store.Get(r.Context(), leagueID, id)

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

	httpx.JSON(w, http.StatusOK, toDetailResponse(profile))
}

const maxSearchLength = 100

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid league ID")
		return
	}

	search := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(search)) > maxSearchLength {
		httpx.Error(w, http.StatusBadRequest, "q must be at most 100 characters long")
		return
	}

	players, err := h.store.List(r.Context(), leagueID, search)
	if errors.Is(err, ErrListLeagueNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "list players", "err", err, "league_id", leagueID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	res := make([]playerResponse, len(players))
	for i, p := range players {
		res[i] = toResponse(p)
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "playerID")
	if !ok {
		return
	}
	leagueID, id := ids[0], ids[1]

	var req updatePlayerRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.store.Update(r.Context(), leagueID, id, Update(req))
	if errors.Is(err, ErrUpdateNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "update player", "err", err, "league_id", leagueID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "playerID")
	if !ok {
		return
	}
	leagueID, id := ids[0], ids[1]

	err := h.store.Delete(r.Context(), leagueID, id)
	if deleteErr, ok := errors.AsType[DeleteError](err); ok {
		switch deleteErr {
		case ErrDeleteNotFound:
			httpx.Error(w, http.StatusNotFound, deleteErr.Error())
			return
		case ErrDeleteHasHistory:
			httpx.Error(w, http.StatusConflict, deleteErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "delete player", "err", err, "league_id", leagueID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
