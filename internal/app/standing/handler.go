package standing

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/app/match"
	"league-s/internal/app/season"
	"league-s/internal/httpx"
)

type Handler struct {
	seasons *season.PostgresStore
	matches *match.PostgresStore
}

func NewHandler(seasons *season.PostgresStore, matches *match.PostgresStore) *Handler {
	return &Handler{seasons: seasons, matches: matches}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.get)
	return r
}

type rowResponse struct {
	Rank           int       `json:"rank"`
	TeamID         uuid.UUID `json:"team_id"`
	TeamName       string    `json:"team_name"`
	Played         int32     `json:"played"`
	Won            int32     `json:"won"`
	Drawn          int32     `json:"drawn"`
	Lost           int32     `json:"lost"`
	GoalsFor       int32     `json:"goals_for"`
	GoalsAgainst   int32     `json:"goals_against"`
	GoalDifference int32     `json:"goal_difference"`
	Points         int32     `json:"points"`
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID")
	if !ok {
		return
	}
	leagueID, seasonID := ids[0], ids[1]

	s, err := h.seasons.Get(r.Context(), leagueID, seasonID)
	if errors.Is(err, season.ErrGetNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "get season for standings", "err", err, "league_id", leagueID, "season_id", seasonID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	registered, err := h.seasons.GetTeams(r.Context(), leagueID, seasonID)
	if err != nil {
		slog.ErrorContext(r.Context(), "list teams for standings", "err", err, "league_id", leagueID, "season_id", seasonID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	matches, err := h.matches.List(r.Context(), leagueID, seasonID, match.Filter{Status: new(match.StatusFinished)})
	if err != nil {
		slog.ErrorContext(r.Context(), "list matches for standings", "err", err, "league_id", leagueID, "season_id", seasonID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	teams := make([]Team, len(registered))
	for i, t := range registered {
		teams[i] = Team{ID: t.ID, Name: t.Name}
	}

	rows := Compute(teams, matches, Rules{
		WinPts:      s.MatchWinPts,
		DrawPts:     s.MatchDrawPts,
		LossPts:     s.MatchLossPts,
		TieBreakers: s.TieBreakers,
	})

	res := make([]rowResponse, len(rows))
	for i, row := range rows {
		res[i] = rowResponse(row)
	}

	httpx.JSON(w, http.StatusOK, res)
}
