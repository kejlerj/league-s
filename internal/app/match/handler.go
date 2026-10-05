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

	"league-s/internal/app/season"
	"league-s/internal/app/team"
	"league-s/internal/httpx"
)

type Handler struct {
	svc     *Service
	store   *PostgresStore
	seasons *season.PostgresStore
}

func NewHandler(svc *Service, store *PostgresStore, seasons *season.PostgresStore) *Handler {
	return &Handler{svc: svc, store: store, seasons: seasons}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.schedule)
	r.Get("/{matchID}", h.get)
	r.Patch("/{matchID}", h.update)
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
	Venue      *string    `json:"venue" validate:"omitempty,min=1,max=100"`
}

type updateRequest struct {
	Matchday      *int32     `json:"matchday" validate:"omitempty,min=1"`
	KickoffAt     *time.Time `json:"kickoff_at"`
	Venue         *string    `json:"venue" validate:"omitempty,min=1,max=100"`
	Referee       *string    `json:"referee" validate:"omitempty,min=1,max=100"`
	ConvocationAt *time.Time `json:"convocation_at"`
	VideoURL      *string    `json:"video_url" validate:"omitempty,http_url"`
}

type postponeRequest struct {
	KickoffAt *time.Time `json:"kickoff_at"`
}

type scoreRequest struct {
	Home *int32 `json:"home" validate:"required,min=0"`
	Away *int32 `json:"away" validate:"required,min=0"`
}

type teamResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Logo *string   `json:"logo"`
}

type matchResponse struct {
	ID        uuid.UUID    `json:"id"`
	SeasonID  uuid.UUID    `json:"season_id"`
	HomeTeam  teamResponse `json:"home_team"`
	AwayTeam  teamResponse `json:"away_team"`
	Matchday  int32        `json:"matchday"`
	KickoffAt *time.Time   `json:"kickoff_at"`
	Status    Status       `json:"status"`
	HomeScore *int32       `json:"home_score"`
	AwayScore *int32       `json:"away_score"`

	Venue         *string    `json:"venue"`
	Referee       *string    `json:"referee"`
	ConvocationAt *time.Time `json:"convocation_at"`
	VideoURL      *string    `json:"video_url"`
}

func utc(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	return new(t.UTC())
}

func toTeamResponse(id uuid.UUID, teams map[uuid.UUID]*team.Team) teamResponse {
	res := teamResponse{ID: id}
	if t, ok := teams[id]; ok {
		res.Name, res.Logo = t.Name, t.Logo
	}
	return res
}

func (h *Handler) teams(ctx context.Context, leagueID, seasonID uuid.UUID) (map[uuid.UUID]*team.Team, error) {
	registered, err := h.seasons.GetTeams(ctx, leagueID, seasonID)
	if err != nil {
		return nil, err
	}

	res := make(map[uuid.UUID]*team.Team, len(registered))
	for _, t := range registered {
		res[t.ID] = t
	}
	return res, nil
}

func toResponse(m *Match, teams map[uuid.UUID]*team.Team) matchResponse {
	res := matchResponse{
		ID:        m.ID(),
		SeasonID:  m.SeasonID(),
		HomeTeam:  toTeamResponse(m.HomeTeamID(), teams),
		AwayTeam:  toTeamResponse(m.AwayTeamID(), teams),
		Matchday:  m.Matchday(),
		KickoffAt: utc(m.KickoffAt()),
		Status:    m.Status(),
	}

	details := m.Details()
	res.Venue = details.Venue
	res.Referee = details.Referee
	res.ConvocationAt = utc(details.ConvocationAt)
	res.VideoURL = details.VideoURL

	if score := m.Score(); score != nil {
		res.HomeScore, res.AwayScore = &score.Home, &score.Away
	}
	return res
}

func (h *Handler) writeMatch(w http.ResponseWriter, r *http.Request, status int, op string, ids []uuid.UUID, m *Match) {
	teams, err := h.teams(r.Context(), ids[0], ids[1])
	if err != nil {
		h.fail(w, r, op, err, ids...)
		return
	}

	httpx.JSON(w, status, toResponse(m, teams))
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

	teams, err := h.teams(r.Context(), ids[0], ids[1])
	if err != nil {
		h.fail(w, r, "list matches", err, ids...)
		return
	}

	res := make([]matchResponse, len(matches))
	for i, m := range matches {
		res[i] = toResponse(m, teams)
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
	if raw := q.Get("status"); raw != "" {
		status := Status(raw)
		switch status {
		case StatusScheduled, StatusLive, StatusFinished, StatusPostponed, StatusCancelled:
			f.Status = &status
		default:
			httpx.Error(w, http.StatusBadRequest, "invalid status")
			return f, false
		}
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

	res, err := h.svc.Schedule(r.Context(), ids[0], ids[1], uuid.MustParse(req.HomeTeamID), uuid.MustParse(req.AwayTeamID), req.Matchday, req.KickoffAt, req.Venue)
	if err != nil {
		h.fail(w, r, "schedule match", err, ids...)
		return
	}

	h.writeMatch(w, r, http.StatusCreated, "schedule match", ids, res)
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

	h.writeMatch(w, r, http.StatusOK, "get match", ids, res)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	var req updateRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	details := Details{
		Venue:         req.Venue,
		Referee:       req.Referee,
		ConvocationAt: req.ConvocationAt,
		VideoURL:      req.VideoURL,
	}
	if req.Matchday == nil && req.KickoffAt == nil && details.isEmpty() {
		httpx.Error(w, http.StatusUnprocessableEntity, "nothing to update")
		return
	}

	res, err := h.svc.Update(r.Context(), ids[0], ids[1], ids[2], req.Matchday, req.KickoffAt, details)
	if err != nil {
		h.fail(w, r, "update match", err, ids...)
		return
	}

	h.writeMatch(w, r, http.StatusOK, "update match", ids, res)
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

	h.writeMatch(w, r, http.StatusOK, op, ids, res)
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

	h.writeMatch(w, r, http.StatusOK, "set match score", ids, res)
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

	h.writeMatch(w, r, http.StatusOK, "postpone match", ids, res)
}
