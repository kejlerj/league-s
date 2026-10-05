package league

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
	r.Get("/{leagueID}", h.get)
	r.Delete("/{leagueID}", h.delete)
	return r
}

type createLeagueRequest struct {
	Name string  `json:"name" validate:"required,max=50"`
	Logo *string `json:"logo" validate:"omitempty,http_url"`
}

type leagueResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Logo *string   `json:"logo"`
}

func toResponse(l *League) leagueResponse {
	return leagueResponse{ID: l.ID, Name: l.Name, Logo: l.Logo}
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createLeagueRequest

	if !httpx.Decode(w, r, &req) {
		return
	}

	league := &League{Name: req.Name, Logo: req.Logo}

	res, err := h.store.Create(r.Context(), league)
	if err != nil {
		slog.ErrorContext(r.Context(), "create league", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusCreated, toResponse(res))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	res, err := h.store.Get(r.Context(), id)
	if getErr, ok := errors.AsType[GetError](err); ok {
		switch getErr {
		case ErrGetNotFound:
			httpx.Error(w, http.StatusNotFound, getErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "get league", "err", err, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	res, err := h.store.List(r.Context())
	if err != nil {
		slog.ErrorContext(r.Context(), "list leagues", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	resp := make([]leagueResponse, len(res))
	for i, l := range res {
		resp[i] = toResponse(l)
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	err = h.store.Delete(r.Context(), id)
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
		slog.ErrorContext(r.Context(), "delete league", "err", err, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
