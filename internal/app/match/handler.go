package match

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/httpx"
)

type Handler struct {
	svc   *Service
	store *PostgresStore
}

func NewHandler(svc *Service, store *PostgresStore) *Handler {
	return &Handler{svc: svc, store: store}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.schedule)
	r.Get("/{matchID}", h.get)
	r.Patch("/{matchID}", h.reschedule)
	r.Delete("/{matchID}", h.delete)
	r.Post("/{matchID}/start", h.start)
	r.Put("/{matchID}/score", h.setScore)
	r.Post("/{matchID}/finish", h.finish)
	r.Post("/{matchID}/postpone", h.postpone)
	r.Post("/{matchID}/cancel", h.cancel)
	return r
}

type scheduleRequest struct {
	HomeTeamID string     `json:"home_team_id" validate:"required,uuid"`
	AwayTeamID string     `json:"away_team_id" validate:"required,uuid,nefield=HomeTeamID"`
	Matchday   int32      `json:"matchday" validate:"required,min=1"`
	KickoffAt  *time.Time `json:"kickoff_at"`
}

type rescheduleRequest struct {
	Matchday  *int32     `json:"matchday" validate:"omitempty,min=1,required_without=KickoffAt"`
	KickoffAt *time.Time `json:"kickoff_at" validate:"required_without=Matchday"`
}

type postponeRequest struct {
	KickoffAt *time.Time `json:"kickoff_at"`
}

type scoreRequest struct {
	Home *int32 `json:"home" validate:"required,min=0"`
	Away *int32 `json:"away" validate:"required,min=0"`
}

type matchResponse struct {
	ID         uuid.UUID  `json:"id"`
	SeasonID   uuid.UUID  `json:"season_id"`
	HomeTeamID uuid.UUID  `json:"home_team_id"`
	AwayTeamID uuid.UUID  `json:"away_team_id"`
	Matchday   int32      `json:"matchday"`
	KickoffAt  *time.Time `json:"kickoff_at"`
	Status     Status     `json:"status"`
	HomeScore  *int32     `json:"home_score"`
	AwayScore  *int32     `json:"away_score"`
}

func toResponse(m *Match) matchResponse {
	res := matchResponse{
		ID:         m.ID(),
		SeasonID:   m.SeasonID(),
		HomeTeamID: m.HomeTeamID(),
		AwayTeamID: m.AwayTeamID(),
		Matchday:   m.Matchday(),
		KickoffAt:  m.KickoffAt(),
		Status:     m.Status(),
	}
	if score := m.Score(); score != nil {
		res.HomeScore, res.AwayScore = &score.Home, &score.Away
	}
	return res
}

func errorStatus(err error) (int, bool) {
	if e, ok := errors.AsType[GetError](err); ok {
		switch e {
		case ErrGetNotFound:
			return http.StatusNotFound, true
		}
	}
	if e, ok := errors.AsType[ScheduleError](err); ok {
		switch e {
		case ErrScheduleSeasonNotFound:
			return http.StatusNotFound, true
		case ErrScheduleTeamBusy:
			return http.StatusConflict, true
		case ErrScheduleTeamNotRegistered, ErrScheduleKickoffOutsideSeason:
			return http.StatusUnprocessableEntity, true
		}
	}
	if e, ok := errors.AsType[NewError](err); ok {
		switch e {
		case ErrNewSameTeams, ErrNewInvalidMatchday:
			return http.StatusUnprocessableEntity, true
		}
	}
	if e, ok := errors.AsType[RescheduleError](err); ok {
		switch e {
		case ErrRescheduleNotPending:
			return http.StatusConflict, true
		case ErrRescheduleInvalidMatchday:
			return http.StatusUnprocessableEntity, true
		}
	}
	if e, ok := errors.AsType[SetScoreError](err); ok {
		switch e {
		case ErrSetScoreNotLive:
			return http.StatusConflict, true
		case ErrSetScoreNegative:
			return http.StatusUnprocessableEntity, true
		}
	}
	if _, ok := errors.AsType[StartError](err); ok {
		return http.StatusConflict, true
	}
	if _, ok := errors.AsType[FinishError](err); ok {
		return http.StatusConflict, true
	}
	if _, ok := errors.AsType[PostponeError](err); ok {
		return http.StatusConflict, true
	}
	if _, ok := errors.AsType[CancelError](err); ok {
		return http.StatusConflict, true
	}
	if _, ok := errors.AsType[DeleteError](err); ok {
		return http.StatusConflict, true
	}
	return 0, false
}

func (h *Handler) fail(w http.ResponseWriter, r *http.Request, op string, err error, ids ...uuid.UUID) {
	if status, ok := errorStatus(err); ok {
		httpx.Error(w, status, err.Error())
		return
	}
	slog.ErrorContext(r.Context(), op, "err", err, "ids", ids)
	httpx.Error(w, http.StatusInternalServerError, "internal error")
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID")
	if !ok {
		return
	}

	filter, ok := parseFilter(w, r)
	if !ok {
		return
	}

	matches, err := h.store.List(r.Context(), ids[0], ids[1], filter)
	if err != nil {
		h.fail(w, r, "list matches", err, ids...)
		return
	}

	res := make([]matchResponse, len(matches))
	for i, m := range matches {
		res[i] = toResponse(m)
	}

	httpx.JSON(w, http.StatusOK, res)
}

func parseFilter(w http.ResponseWriter, r *http.Request) (Filter, bool) {
	var f Filter
	q := r.URL.Query()

	if raw := q.Get("matchday"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 32)
		if err != nil || n < 1 {
			httpx.Error(w, http.StatusBadRequest, "invalid matchday")
			return f, false
		}
		f.Matchday = new(int32(n))
	}
	if raw := q.Get("from"); raw != "" {
		d, err := time.Parse(time.DateOnly, raw)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid from, want YYYY-MM-DD")
			return f, false
		}
		f.From = &d
	}
	if raw := q.Get("to"); raw != "" {
		d, err := time.Parse(time.DateOnly, raw)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid to, want YYYY-MM-DD")
			return f, false
		}
		f.To = new(d.AddDate(0, 0, 1))
	}
	if raw := q.Get("team"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil || len(raw) != 36 {
			httpx.Error(w, http.StatusBadRequest, "invalid team")
			return f, false
		}
		f.TeamID = &id
	}

	return f, true
}

func (h *Handler) schedule(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID")
	if !ok {
		return
	}

	var req scheduleRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.svc.Schedule(r.Context(), ids[0], ids[1], uuid.MustParse(req.HomeTeamID), uuid.MustParse(req.AwayTeamID), req.Matchday, req.KickoffAt)
	if err != nil {
		h.fail(w, r, "schedule match", err, ids...)
		return
	}

	httpx.JSON(w, http.StatusCreated, toResponse(res))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	res, err := h.store.Get(r.Context(), ids[0], ids[1], ids[2])
	if err != nil {
		h.fail(w, r, "get match", err, ids...)
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) reschedule(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	var req rescheduleRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.svc.Reschedule(r.Context(), ids[0], ids[1], ids[2], req.Matchday, req.KickoffAt)
	if err != nil {
		h.fail(w, r, "reschedule match", err, ids...)
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	if err := h.svc.Delete(r.Context(), ids[0], ids[1], ids[2]); err != nil {
		h.fail(w, r, "delete match", err, ids...)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) start(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "start match", h.svc.Start)
}

func (h *Handler) finish(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "finish match", h.svc.Finish)
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "cancel match", h.svc.Cancel)
}

func (h *Handler) transition(w http.ResponseWriter, r *http.Request, op string, apply func(ctx context.Context, leagueID, seasonID, id uuid.UUID) (*Match, error)) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	res, err := apply(r.Context(), ids[0], ids[1], ids[2])
	if err != nil {
		h.fail(w, r, op, err, ids...)
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) setScore(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	var req scoreRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.svc.SetScore(r.Context(), ids[0], ids[1], ids[2], *req.Home, *req.Away)
	if err != nil {
		h.fail(w, r, "set match score", err, ids...)
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) postpone(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	var req postponeRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.svc.Postpone(r.Context(), ids[0], ids[1], ids[2], req.KickoffAt)
	if err != nil {
		h.fail(w, r, "postpone match", err, ids...)
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}
