package auth

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/httpx"
)

type InvitationHandler struct {
	svc      *Invitations
	store    *PostgresStore
	adminURL string
}

func NewInvitationHandler(svc *Invitations, store *PostgresStore, adminURL string) *InvitationHandler {
	return &InvitationHandler{svc: svc, store: store, adminURL: adminURL}
}

func (h *InvitationHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/lookup", h.lookup)
	r.Post("/accept", h.accept)
	return r
}

func (h *InvitationHandler) LeagueRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.invite)
	r.Get("/", h.list)
	r.Delete("/{invitationID}", h.cancel)
	return r
}

type inviteRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type lookupRequest struct {
	Token string `json:"token" validate:"required"`
}

type acceptRequest struct {
	Token    string `json:"token" validate:"required"`
	Name     string `json:"name" validate:"max=100"`
	Password string `json:"password"`
}

type invitationResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	ExpiresAt time.Time `json:"expires_at"`
}

type createdInvitationResponse struct {
	invitationResponse
	Link string `json:"link"`
}

type pendingInvitationResponse struct {
	Email         string         `json:"email"`
	League        leagueResponse `json:"league"`
	AccountExists bool           `json:"account_exists"`
}

func toInvitationResponse(inv Invitation) invitationResponse {
	return invitationResponse{ID: inv.ID, Email: inv.Email, ExpiresAt: inv.ExpiresAt.UTC()}
}

func (h *InvitationHandler) invite(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid leagueID")
		return
	}

	var req inviteRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	inv, token, err := h.svc.Invite(r.Context(), leagueID, req.Email)
	switch {
	case errors.Is(err, ErrInviteAlreadyAdmin):
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	case errors.Is(err, ErrInviteLeagueNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	case err != nil:
		slog.ErrorContext(r.Context(), "invite league admin", "err", err, "league_id", leagueID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusCreated, createdInvitationResponse{
		invitationResponse: toInvitationResponse(*inv),
		Link:               h.adminURL + "/invitation?token=" + token,
	})
}

func (h *InvitationHandler) list(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid leagueID")
		return
	}

	invitations, err := h.store.Invitations(r.Context(), leagueID, time.Now())
	if err != nil {
		slog.ErrorContext(r.Context(), "list invitations", "err", err, "league_id", leagueID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	res := make([]invitationResponse, len(invitations))
	for i, inv := range invitations {
		res[i] = toInvitationResponse(inv)
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *InvitationHandler) cancel(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "invitationID")
	if !ok {
		return
	}
	leagueID, id := ids[0], ids[1]

	err := h.store.DeleteInvitation(r.Context(), leagueID, id)
	if errors.Is(err, ErrInvitationNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "cancel invitation", "err", err, "league_id", leagueID, "id", id)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *InvitationHandler) lookup(w http.ResponseWriter, r *http.Request) {
	var req lookupRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	pending, err := h.svc.Lookup(r.Context(), req.Token)
	if errors.Is(err, ErrInvitationInvalidLink) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "look up invitation", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.JSON(w, http.StatusOK, pendingInvitationResponse{
		Email:         pending.Email,
		League:        leagueResponse(pending.League),
		AccountExists: pending.AccountExists,
	})
}

func (h *InvitationHandler) accept(w http.ResponseWriter, r *http.Request) {
	var req acceptRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	err := h.svc.Accept(r.Context(), req.Token, req.Name, req.Password)
	if passwordErr, ok := errors.AsType[PasswordError](err); ok {
		httpx.Error(w, http.StatusUnprocessableEntity, passwordErr.Error())
		return
	}
	switch {
	case errors.Is(err, ErrInvitationAccountRequired):
		httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	case errors.Is(err, ErrInvitationInvalidLink):
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	case err != nil:
		slog.ErrorContext(r.Context(), "accept invitation", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *InvitationHandler) AdminRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.admins)
	r.With(Superadmin).Delete("/{userID}", h.removeAdmin)
	return r
}

type adminResponse struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
	Name  string    `json:"name"`
}

func (h *InvitationHandler) admins(w http.ResponseWriter, r *http.Request) {
	leagueID, err := httpx.IDParam(r, "leagueID")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid leagueID")
		return
	}

	users, err := h.store.LeagueAdmins(r.Context(), leagueID)
	if err != nil {
		slog.ErrorContext(r.Context(), "list league admins", "err", err, "league_id", leagueID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	res := make([]adminResponse, len(users))
	for i, u := range users {
		res[i] = adminResponse{ID: u.ID, Email: u.Email, Name: u.Name}
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *InvitationHandler) removeAdmin(w http.ResponseWriter, r *http.Request) {
	ids, ok := httpx.IDParams(w, r, "leagueID", "userID")
	if !ok {
		return
	}
	leagueID, userID := ids[0], ids[1]

	err := h.store.RemoveLeagueAdmin(r.Context(), userID, leagueID)
	if errors.Is(err, ErrRemoveAdminNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "remove league admin", "err", err, "league_id", leagueID, "user_id", userID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
