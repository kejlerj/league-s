package match

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/app/auth"
	"league-s/internal/httpx"
)

type LeagueAdminChecker interface {
	CanWrite(ctx context.Context, user *auth.User, leagueID uuid.UUID) (bool, error)
}

type EventHandler struct {
	svc    *Service
	store  *PostgresStore
	admins LeagueAdminChecker
}

func NewEventHandler(svc *Service, store *PostgresStore, admins LeagueAdminChecker) *EventHandler {
	return &EventHandler{svc: svc, store: store, admins: admins}
}

func (h *EventHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.record)
	r.Delete("/{eventID}", h.delete)
	return r
}

type eventRequest struct {
	Type           string  `json:"type" validate:"required,oneof=goal yellow_card red_card substitution injury"`
	TeamID         string  `json:"team_id" validate:"required,uuid"`
	Minute         int32   `json:"minute" validate:"required,min=1,max=150"`
	PlayerID       *string `json:"player_id" validate:"omitempty,uuid"`
	AssistPlayerID *string `json:"assist_player_id" validate:"omitempty,uuid"`
	PlayerInID     *string `json:"player_in_id" validate:"omitempty,uuid"`
	OwnGoal        bool    `json:"own_goal"`
	Penalty        bool    `json:"penalty"`
	Note           *string `json:"note"`
}

func optionalID(raw *string) *uuid.UUID {
	if raw == nil {
		return nil
	}
	return new(uuid.MustParse(*raw))
}

func (req eventRequest) toEvent() Event {
	return Event{
		TeamID:         uuid.MustParse(req.TeamID),
		Type:           EventType(req.Type),
		Minute:         req.Minute,
		PlayerID:       optionalID(req.PlayerID),
		AssistPlayerID: optionalID(req.AssistPlayerID),
		PlayerInID:     optionalID(req.PlayerInID),
		OwnGoal:        req.OwnGoal,
		Penalty:        req.Penalty,
		Note:           req.Note,
	}
}

type eventPlayerResponse struct {
	ID        uuid.UUID `json:"id"`
	Firstname string    `json:"firstname"`
	Lastname  string    `json:"lastname"`
}

type eventResponse struct {
	ID           uuid.UUID            `json:"id"`
	MatchID      uuid.UUID            `json:"match_id"`
	TeamID       uuid.UUID            `json:"team_id"`
	Type         EventType            `json:"type"`
	Minute       int32                `json:"minute"`
	Player       *eventPlayerResponse `json:"player"`
	AssistPlayer *eventPlayerResponse `json:"assist_player"`
	PlayerIn     *eventPlayerResponse `json:"player_in"`
	OwnGoal      bool                 `json:"own_goal"`
	Penalty      bool                 `json:"penalty"`
	Note         *string              `json:"note"`
	SentOff      bool                 `json:"sent_off"`
	HomeScore    *int32               `json:"home_score"`
	AwayScore    *int32               `json:"away_score"`
}

func toPlayerResponse(p *PlayerName) *eventPlayerResponse {
	if p == nil {
		return nil
	}
	return &eventPlayerResponse{ID: p.ID, Firstname: p.Firstname, Lastname: p.Lastname}
}

func toEventResponses(m *Match, views []EventView, showNote bool) []eventResponse {
	events := make([]Event, len(views))
	for i, v := range views {
		events[i] = v.Event
	}
	summaries := SummarizeEvents(m.HomeTeamID(), events)

	res := make([]eventResponse, len(views))
	for i, v := range views {
		res[i] = eventResponse{
			ID:           v.ID,
			MatchID:      v.MatchID,
			TeamID:       v.TeamID,
			Type:         v.Type,
			Minute:       v.Minute,
			Player:       toPlayerResponse(v.Player),
			AssistPlayer: toPlayerResponse(v.AssistPlayer),
			PlayerIn:     toPlayerResponse(v.PlayerIn),
			OwnGoal:      v.OwnGoal,
			Penalty:      v.Penalty,
			SentOff:      summaries[i].SentOff,
		}
		if showNote {
			res[i].Note = v.Note
		}
		if score := summaries[i].Score; score != nil {
			res[i].HomeScore, res[i].AwayScore = &score.Home, &score.Away
		}
	}
	return res
}

type eventField struct {
	name    string
	message string
}

const notInSquad = "n'est pas dans l'effectif de l'équipe ce jour-là"

var eventFields = map[EventError]eventField{
	ErrEventInvalidType:             {"type", "doit valoir goal, yellow_card, red_card, substitution ou injury"},
	ErrEventInvalidMinute:           {"minute", "doit être entre 1 et 150"},
	ErrEventTeamNotInMatch:          {"team_id", "n'est pas une équipe du match"},
	ErrEventPlayerRequired:          {"player_id", "obligatoire"},
	ErrEventPlayerInRequired:        {"player_in_id", "obligatoire"},
	ErrEventPlayerInIsPlayer:        {"player_in_id", "doit être différent de player_id"},
	ErrEventPlayerInNotSubstitution: {"player_in_id", "n'est permis que pour un remplacement"},
	ErrEventAssistNotGoal:           {"assist_player_id", "n'est permis que pour un but"},
	ErrEventOwnGoalNotGoal:          {"own_goal", "n'est permis que pour un but"},
	ErrEventPenaltyNotGoal:          {"penalty", "n'est permis que pour un but"},
	ErrEventAssistOnSetPiece:        {"assist_player_id", "n'est pas permis sur un penalty ou un but contre son camp"},
	ErrEventAssistIsScorer:          {"assist_player_id", "doit être différent de player_id"},
	ErrEventNoteNotInjury:           {"note", "n'est permis que pour une blessure"},
	ErrEventNoteLength:              {"note", "doit faire entre 1 et 200 caractères"},
	ErrEventPlayerNotInSquad:        {"player_id", notInSquad},
	ErrEventAssistNotInSquad:        {"assist_player_id", notInSquad},
	ErrEventPlayerInNotInSquad:      {"player_in_id", notInSquad},
}

func eventErrorStatus(e EventError) int {
	if _, ok := eventFields[e]; ok {
		return http.StatusUnprocessableEntity
	}
	if e == ErrEventNotFound {
		return http.StatusNotFound
	}
	return http.StatusConflict
}

func (h *EventHandler) fail(w http.ResponseWriter, r *http.Request, op string, err error, ids ...uuid.UUID) {
	if e, ok := errors.AsType[EventError](err); ok {
		if field, ok := eventFields[e]; ok {
			httpx.FieldErrors(w, map[string]string{field.name: field.message})
			return
		}
	}
	if status, ok := errorStatus(err); ok {
		httpx.Error(w, status, err.Error())
		return
	}
	slog.ErrorContext(r.Context(), op, "err", err, "ids", ids)
	httpx.Error(w, http.StatusInternalServerError, "internal error")
}

func (h *EventHandler) isLeagueAdmin(ctx context.Context, leagueID uuid.UUID) (bool, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return false, nil
	}
	return h.admins.CanWrite(ctx, user, leagueID)
}

func (h *EventHandler) list(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	m, err := h.store.Get(r.Context(), ids[0], ids[1], ids[2])
	if err != nil {
		h.fail(w, r, "list match events", err, ids...)
		return
	}
	views, err := h.store.ListEventViews(r.Context(), ids[0], ids[1], ids[2])
	if err != nil {
		h.fail(w, r, "list match events", err, ids...)
		return
	}
	showNote, err := h.isLeagueAdmin(r.Context(), ids[0])
	if err != nil {
		h.fail(w, r, "list match events", err, ids...)
		return
	}

	httpx.JSON(w, http.StatusOK, toEventResponses(m, views, showNote))
}

func (h *EventHandler) record(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID")
	if !ok {
		return
	}

	var req eventRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	created, err := h.svc.RecordEvent(r.Context(), ids[0], ids[1], ids[2], req.toEvent())
	if err != nil {
		h.fail(w, r, "record match event", err, ids...)
		return
	}

	m, err := h.store.Get(r.Context(), ids[0], ids[1], ids[2])
	if err != nil {
		h.fail(w, r, "record match event", err, ids...)
		return
	}
	views, err := h.store.ListEventViews(r.Context(), ids[0], ids[1], ids[2])
	if err != nil {
		h.fail(w, r, "record match event", err, ids...)
		return
	}
	for _, e := range toEventResponses(m, views, true) {
		if e.ID == created.ID {
			httpx.JSON(w, http.StatusCreated, e)
			return
		}
	}
	h.fail(w, r, "record match event", ErrEventNotFound, ids...)
}

func (h *EventHandler) delete(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "seasonID", "matchID", "eventID")
	if !ok {
		return
	}

	if err := h.svc.DeleteEvent(r.Context(), ids[0], ids[1], ids[2], ids[3]); err != nil {
		h.fail(w, r, "delete match event", err, ids...)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
