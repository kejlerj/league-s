package season

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/app/team"
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
	r.Get("/{seasonID}", h.get)
	r.Get("/{seasonID}/teams", h.getTeams)
	r.Post("/{seasonID}/teams/{teamID}", h.addTeam)
	r.Delete("/{seasonID}/teams/{teamID}", h.removeTeam)
	return r
}

type createSeasonRequest struct {
	Name         string    `json:"name" validate:"required,max=50"`
	StartOn      time.Time `json:"start_on" validate:"required"`
	EndOn        time.Time `json:"end_on" validate:"required,gtfield=StartOn"`
	MatchWinPts  int32     `json:"match_win_pts" validate:"min=0"`
	MatchDrawPts int32     `json:"match_draw_pts" validate:"min=0"`
	MatchLossPts int32     `json:"match_loss_pts" validate:"min=0"`
	TieBreakers  []string  `json:"tie_breakers" validate:"omitempty,dive,oneof=goal_difference goals_scored head_to_head fair_play random"`
}

type seasonResponse struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	StartOn      time.Time `json:"start_on"`
	EndOn        time.Time `json:"end_on"`
	MatchWinPts  int32     `json:"match_win_pts"`
	MatchDrawPts int32     `json:"match_draw_pts"`
	MatchLossPts int32     `json:"match_loss_pts"`
	TieBreakers  []string  `json:"tie_breakers"`
	LeagueID     uuid.UUID `json:"league_id"`
}

func toResponse(s *Season) seasonResponse {
	return seasonResponse{
		ID:           s.ID,
		Name:         s.Name,
		StartOn:      s.StartOn,
		EndOn:        s.EndOn,
		MatchWinPts:  s.MatchWinPts,
		MatchDrawPts: s.MatchDrawPts,
		MatchLossPts: s.MatchLossPts,
		TieBreakers:  s.TieBreakers,
		LeagueID:     s.LeagueID,
	}
}

type seasonTeamResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Logo *string   `json:"logo"`
}

func toSeasonTeamResponse(t *team.Team) seasonTeamResponse {
	return seasonTeamResponse{
		ID:   t.ID,
		Name: t.Name,
		Logo: t.Logo,
	}
}

func pathIDs(w http.ResponseWriter, r *http.Request, names ...string) ([]uuid.UUID, bool) {
	ids := make([]uuid.UUID, len(names))
	for i, name := range names {
		id, err := httpx.IDParam(r, name)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid "+name)
			return nil, false
		}
		ids[i] = id
	}
	return ids, true
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ids, ok := pathIDs(w, r, "leagueID")
	if !ok {
		return
	}
	leagueID := ids[0]

	var req createSeasonRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	season := &Season{
		Name:         req.Name,
		StartOn:      req.StartOn,
		EndOn:        req.EndOn,
		MatchWinPts:  req.MatchWinPts,
		MatchDrawPts: req.MatchDrawPts,
		MatchLossPts: req.MatchLossPts,
		TieBreakers:  req.TieBreakers,
		LeagueID:     leagueID,
	}

	res, err := h.store.Create(r.Context(), season)
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
		slog.ErrorContext(r.Context(), "create season", "err", err, "league_id", leagueID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusCreated, toResponse(res))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ids, ok := pathIDs(w, r, "leagueID", "seasonID")
	if !ok {
		return
	}
	leagueID, id := ids[0], ids[1]

	season, err := h.store.Get(r.Context(), leagueID, id)
	if getErr, ok := errors.AsType[GetError](err); ok {
		switch getErr {
		case ErrGetNotFound:
			httpx.Error(w, http.StatusNotFound, getErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "get season", "err", err, "league_id", leagueID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(season))
}

func (h *Handler) getTeams(w http.ResponseWriter, r *http.Request) {
	ids, ok := pathIDs(w, r, "leagueID", "seasonID")
	if !ok {
		return
	}
	leagueID, seasonID := ids[0], ids[1]

	teams, err := h.store.GetTeams(r.Context(), leagueID, seasonID)
	if err != nil {
		slog.ErrorContext(r.Context(), "list season teams", "err", err, "league_id", leagueID, "season_id", seasonID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	res := make([]seasonTeamResponse, len(teams))
	for i, t := range teams {
		res[i] = toSeasonTeamResponse(t)
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) addTeam(w http.ResponseWriter, r *http.Request) {
	ids, ok := pathIDs(w, r, "leagueID", "seasonID", "teamID")
	if !ok {
		return
	}
	leagueID, seasonID, teamID := ids[0], ids[1], ids[2]

	err := h.store.AddTeam(r.Context(), leagueID, seasonID, teamID)

	if addTeamErr, ok := errors.AsType[AddTeamError](err); ok {
		switch addTeamErr {
		case ErrAddTeamNotFound:
			httpx.Error(w, http.StatusNotFound, addTeamErr.Error())
			return
		case ErrAddTeamSeasonNotFound:
			httpx.Error(w, http.StatusNotFound, addTeamErr.Error())
			return
		case ErrAddTeamAlreadyExists:
			httpx.Error(w, http.StatusConflict, addTeamErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "add team to season", "err", err, "league_id", leagueID, "season_id", seasonID, "team_id", teamID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"message": "team added to season"})
}

func (h *Handler) removeTeam(w http.ResponseWriter, r *http.Request) {
	ids, ok := pathIDs(w, r, "leagueID", "seasonID", "teamID")
	if !ok {
		return
	}
	leagueID, seasonID, teamID := ids[0], ids[1], ids[2]

	err := h.store.RemoveTeam(r.Context(), leagueID, seasonID, teamID)
	if removeTeamErr, ok := errors.AsType[RemoveTeamError](err); ok {
		switch removeTeamErr {
		case ErrRemoveTeamNotRegistered:
			httpx.Error(w, http.StatusNotFound, removeTeamErr.Error())
			return
		case ErrRemoveTeamHasMatches:
			httpx.Error(w, http.StatusConflict, removeTeamErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "remove team from season", "err", err, "league_id", leagueID, "season_id", seasonID, "team_id", teamID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"message": "team removed from season"})
}
