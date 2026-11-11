package ranking

import (
	"errors"
	"log/slog"
	"net/http"

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

type rowResponse struct {
	Rank      int       `json:"rank"`
	PlayerID  uuid.UUID `json:"player_id"`
	Firstname string    `json:"firstname"`
	Lastname  string    `json:"lastname"`
	TeamID    uuid.UUID `json:"team_id"`
	TeamName  string    `json:"team_name"`
	Value     int32     `json:"value"`
}

func (h *Handler) Scorers(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, "scorers", Scorers)
}

func (h *Handler) Assists(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, "assists", Assists)
}

func (h *Handler) serve(w http.ResponseWriter, r *http.Request, name string, build func([]match.EventView) []Row) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID")
	if !ok {
		return
	}
	leagueID, seasonID := ids[0], ids[1]
	fail := func(op string, err error) {
		slog.ErrorContext(r.Context(), op+" for "+name, "err", err, "league_id", leagueID, "season_id", seasonID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
	}

	_, err := h.seasons.Get(r.Context(), leagueID, seasonID)
	if errors.Is(err, season.ErrGetNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		fail("get season", err)
		return
	}

	registered, err := h.seasons.GetTeams(r.Context(), leagueID, seasonID)
	if err != nil {
		fail("list teams", err)
		return
	}
	teamNames := make(map[uuid.UUID]string, len(registered))
	for _, t := range registered {
		teamNames[t.ID] = t.Name
	}

	goals, err := h.matches.ListFinishedSeasonEvents(r.Context(), leagueID, seasonID, match.EventGoal)
	if err != nil {
		fail("list goals", err)
		return
	}

	rows := build(goals)
	res := make([]rowResponse, len(rows))
	for i, row := range rows {
		res[i] = rowResponse{
			Rank:      row.Rank,
			PlayerID:  row.PlayerID,
			Firstname: row.Firstname,
			Lastname:  row.Lastname,
			TeamID:    row.TeamID,
			TeamName:  teamNames[row.TeamID],
			Value:     row.Value,
		}
	}

	httpx.JSON(w, http.StatusOK, res)
}
