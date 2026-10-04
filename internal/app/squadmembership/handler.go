package squadmembership

import (
	"errors"
	"log/slog"
	"net/http"

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
	r.Post("/", h.join)
	r.Patch("/{membershipID}", h.changeNumber)
	r.Post("/{membershipID}/leave", h.leave)
	return r
}

func (h *Handler) TransferRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.transfer)
	return r
}

type joinRequest struct {
	PlayerID string `json:"player_id" validate:"required,uuid"`
	Number   *int32 `json:"number" validate:"omitempty,min=1,max=99"`
	JoinedOn string `json:"joined_on" validate:"required,datetime=2006-01-02"`
}

type changeNumberRequest struct {
	Number *int32 `json:"number" validate:"omitempty,min=1,max=99"`
}

type leaveRequest struct {
	LeftOn string `json:"left_on" validate:"required,datetime=2006-01-02"`
}

type transferRequest struct {
	PlayerID   string `json:"player_id" validate:"required,uuid"`
	FromTeamID string `json:"from_team_id" validate:"required,uuid"`
	ToTeamID   string `json:"to_team_id" validate:"required,uuid,nefield=FromTeamID"`
	Number     *int32 `json:"number" validate:"omitempty,min=1,max=99"`
	On         string `json:"on" validate:"required,datetime=2006-01-02"`
}

type membershipResponse struct {
	ID       uuid.UUID `json:"id"`
	LeagueID uuid.UUID `json:"league_id"`
	SeasonID uuid.UUID `json:"season_id"`
	TeamID   uuid.UUID `json:"team_id"`
	PlayerID uuid.UUID `json:"player_id"`
	Number   *int32    `json:"number"`
	JoinedOn string    `json:"joined_on"`
	LeftOn   *string   `json:"left_on"`
}

type memberResponse struct {
	MembershipID uuid.UUID `json:"membership_id"`
	PlayerID     uuid.UUID `json:"player_id"`
	Firstname    string    `json:"firstname"`
	Lastname     string    `json:"lastname"`
	Icon         *string   `json:"icon"`
	Number       *int32    `json:"number"`
	JoinedOn     string    `json:"joined_on"`
	LeftOn       *string   `json:"left_on"`
}

func toResponse(m *Membership) membershipResponse {
	return membershipResponse{
		ID:       m.ID,
		LeagueID: m.LeagueID,
		SeasonID: m.SeasonID,
		TeamID:   m.TeamID,
		PlayerID: m.PlayerID,
		Number:   m.Number,
		JoinedOn: httpx.FormatDate(m.JoinedOn),
		LeftOn:   httpx.FormatOptionalDate(m.LeftOn),
	}
}

func toMemberResponse(m *Member) memberResponse {
	return memberResponse{
		MembershipID: m.MembershipID,
		PlayerID:     m.ID,
		Firstname:    m.Firstname,
		Lastname:     m.Lastname,
		Icon:         m.Icon,
		Number:       m.Number,
		JoinedOn:     httpx.FormatDate(m.JoinedOn),
		LeftOn:       httpx.FormatOptionalDate(m.LeftOn),
	}
}

func joinStatus(err JoinError) int {
	switch err {
	case ErrJoinPlayerNotFound, ErrJoinTeamNotRegistered:
		return http.StatusNotFound
	case ErrJoinPlayerAlreadyActive, ErrJoinNumberTaken, ErrJoinSquadFull:
		return http.StatusConflict
	case ErrJoinOutsideSeason:
		return http.StatusUnprocessableEntity
	}
	return http.StatusInternalServerError
}

func leaveStatus(err LeaveError) int {
	switch err {
	case ErrLeaveNotFound, ErrLeaveTeamNotRegistered:
		return http.StatusNotFound
	case ErrLeaveNotActive:
		return http.StatusConflict
	case ErrLeaveBeforeJoining, ErrLeaveOutsideSeason:
		return http.StatusUnprocessableEntity
	}
	return http.StatusInternalServerError
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "teamID")
	if !ok {
		return
	}
	leagueID, seasonID, teamID := ids[0], ids[1], ids[2]
	includeHistory := r.URL.Query().Get("all") == "true"

	members, err := h.store.List(r.Context(), leagueID, seasonID, teamID, includeHistory)
	if err != nil {
		slog.ErrorContext(r.Context(), "list squad", "err", err, "league_id", leagueID, "season_id", seasonID, "team_id", teamID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	res := make([]memberResponse, len(members))
	for i, m := range members {
		res[i] = toMemberResponse(m)
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) join(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "teamID")
	if !ok {
		return
	}
	leagueID, seasonID, teamID := ids[0], ids[1], ids[2]

	var req joinRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.svc.Join(r.Context(), &Membership{
		LeagueID: leagueID,
		SeasonID: seasonID,
		TeamID:   teamID,
		PlayerID: uuid.MustParse(req.PlayerID),
		Number:   req.Number,
		JoinedOn: httpx.MustDate(req.JoinedOn),
	})
	if joinErr, ok := errors.AsType[JoinError](err); ok {
		httpx.Error(w, joinStatus(joinErr), joinErr.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "join squad", "err", err, "league_id", leagueID, "season_id", seasonID, "team_id", teamID, "player_id", req.PlayerID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusCreated, toResponse(res))
}

func (h *Handler) changeNumber(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "teamID", "membershipID")
	if !ok {
		return
	}
	leagueID, seasonID, teamID, id := ids[0], ids[1], ids[2], ids[3]

	var req changeNumberRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.store.ChangeNumber(r.Context(), leagueID, seasonID, teamID, id, req.Number)
	if changeErr, ok := errors.AsType[ChangeNumberError](err); ok {
		switch changeErr {
		case ErrChangeNumberNotActive:
			httpx.Error(w, http.StatusNotFound, changeErr.Error())
			return
		case ErrChangeNumberTaken:
			httpx.Error(w, http.StatusConflict, changeErr.Error())
			return
		}
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "change squad number", "err", err, "league_id", leagueID, "season_id", seasonID, "team_id", teamID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) leave(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "teamID", "membershipID")
	if !ok {
		return
	}
	leagueID, seasonID, teamID, id := ids[0], ids[1], ids[2], ids[3]

	var req leaveRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.svc.Leave(r.Context(), leagueID, seasonID, teamID, id, httpx.MustDate(req.LeftOn))
	if leaveErr, ok := errors.AsType[LeaveError](err); ok {
		httpx.Error(w, leaveStatus(leaveErr), leaveErr.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "leave squad", "err", err, "league_id", leagueID, "season_id", seasonID, "team_id", teamID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, toResponse(res))
}

func (h *Handler) transfer(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID")
	if !ok {
		return
	}
	leagueID, seasonID := ids[0], ids[1]

	var req transferRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	res, err := h.svc.Transfer(r.Context(), Transfer{
		LeagueID:   leagueID,
		SeasonID:   seasonID,
		PlayerID:   uuid.MustParse(req.PlayerID),
		FromTeamID: uuid.MustParse(req.FromTeamID),
		ToTeamID:   uuid.MustParse(req.ToTeamID),
		Number:     req.Number,
		On:         httpx.MustDate(req.On),
	})
	if leaveErr, ok := errors.AsType[LeaveError](err); ok {
		httpx.Error(w, leaveStatus(leaveErr), leaveErr.Error())
		return
	}
	if joinErr, ok := errors.AsType[JoinError](err); ok {
		httpx.Error(w, joinStatus(joinErr), joinErr.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "transfer player", "err", err, "league_id", leagueID, "season_id", seasonID, "player_id", req.PlayerID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusCreated, toResponse(res))
}
