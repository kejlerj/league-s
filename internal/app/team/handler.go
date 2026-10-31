package team

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

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.create)
	r.Get("/", h.list)
	r.Get("/{teamID}", h.get)
	r.Patch("/{teamID}", h.update)
	r.Delete("/{teamID}", h.delete)
	return r
}

type createTeamRequest struct {
	Name string  `json:"name" validate:"required,max=50"`
	Logo *string `json:"logo" validate:"omitempty,http_url"`
}

type updateTeamRequest struct {
	Name *string `json:"name" validate:"omitnil,min=1,max=50"`
	Logo *string `json:"logo" validate:"omitnil,http_url"`
}

type teamResponse struct {
	ID       uuid.UUID `json:"id"`
	LeagueID uuid.UUID `json:"league_id"`
	Name     string    `json:"name"`
	Logo     *string   `json:"logo"`
}

func toResponse(t *Team) teamResponse {
	return teamResponse{ID: t.ID, LeagueID: t.LeagueID, Name: t.Name, Logo: t.Logo}
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid league id")
		return
	}

	var req createTeamRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	team := &Team{LeagueID: leagueID, Name: req.Name, Logo: req.Logo}

	res, err := h.store.Create(r.Context(), team)
	if createErr, ok := errors.AsType[CreateError](err); ok {
		switch createErr {
		case ErrCreateLeagueNotFound:
			httpx.Error(w, http.StatusNotFound, createErr.Error())
			return
		case ErrCreateNameTaken:
			httpx.Error(w, http.StatusConflict, createErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "create team", "err", err, "league_id", leagueID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusCreated, toResponse(res))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid league id")
		return
	}
	id, err := httpx.IDParam(r, "teamID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	team, err := h.store.Get(r.Context(), leagueID, id)

	if getErr, ok := errors.AsType[GetError](err); ok {
		switch getErr {
		case ErrGetNotFound:
			httpx.Error(w, http.StatusNotFound, getErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "get team", "err", err, "league_id", leagueID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(team))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid league id")
		return
	}

	teams, err := h.store.List(r.Context(), leagueID)
	if errors.Is(err, ErrListLeagueNotFound) {
		httpx.Error(w, http.StatusNotFound, ErrListLeagueNotFound.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "list teams", "err", err, "league_id", leagueID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	res := make([]teamResponse, len(teams))
	for i, t := range teams {
		res[i] = toResponse(t)
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "teamID")
	if !ok {
		return
	}
	leagueID, id := ids[0], ids[1]

	var req updateTeamRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.store.Update(r.Context(), leagueID, id, Update(req))
	if updateErr, ok := errors.AsType[UpdateError](err); ok {
		switch updateErr {
		case ErrUpdateNotFound:
			httpx.Error(w, http.StatusNotFound, updateErr.Error())
			return
		case ErrUpdateNameTaken:
			httpx.Error(w, http.StatusConflict, updateErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "update team", "err", err, "league_id", leagueID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "teamID")
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
		slog.ErrorContext(r.Context(), "delete team", "err", err, "league_id", leagueID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
