package auth

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/httpx"
)

type Handler struct {
	svc          *Service
	store        *PostgresStore
	secureCookie bool
}

func NewHandler(svc *Service, store *PostgresStore, secureCookie bool) *Handler {
	return &Handler{svc: svc, store: store, secureCookie: secureCookie}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/login", h.login)
	r.Post("/logout", h.logout)
	r.Post("/password-reset", h.requestPasswordReset)
	r.Post("/password-reset/confirm", h.resetPassword)
	return r
}

type passwordResetRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type resetPasswordRequest struct {
	Token    string `json:"token" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required"`
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type userResponse struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	IsSuperadmin bool      `json:"is_superadmin"`
}

type leagueResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type meResponse struct {
	userResponse
	Leagues []leagueResponse `json:"leagues"`
}

func toResponse(u *User) userResponse {
	return userResponse{ID: u.ID, Email: u.Email, Name: u.Name, IsSuperadmin: u.IsSuperadmin}
}

func (h *Handler) cookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	}
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	token, user, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if errors.Is(err, ErrLoginInvalidCredentials) {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "login", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	http.SetCookie(w, h.cookie(token, int(SessionTTL.Seconds())))
	httpx.JSON(w, http.StatusOK, toResponse(user))
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if token := tokenFrom(r); token != "" {
		if err := h.svc.Logout(r.Context(), token); err != nil {
			slog.ErrorContext(r.Context(), "logout", "err", err)
			httpx.Error(w, http.StatusInternalServerError, "internal error")
			return
		}
	}

	http.SetCookie(w, h.cookie("", -1))
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFrom(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}

	leagues, err := h.store.AdminLeagues(r.Context(), user.ID)
	if err != nil {
		slog.ErrorContext(r.Context(), "list admin leagues", "err", err, "user_id", user.ID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	res := meResponse{userResponse: toResponse(user), Leagues: make([]leagueResponse, len(leagues))}
	for i, l := range leagues {
		res.Leagues[i] = leagueResponse(l)
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req passwordResetRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	if err := h.svc.RequestPasswordReset(r.Context(), req.Email); err != nil {
		slog.ErrorContext(r.Context(), "request password reset", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	err := h.svc.ResetPassword(r.Context(), req.Token, req.Password)
	if passwordErr, ok := errors.AsType[PasswordError](err); ok {
		httpx.Error(w, http.StatusUnprocessableEntity, passwordErr.Error())
		return
	}
	if errors.Is(err, ErrResetInvalidLink) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "reset password", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFrom(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req changePasswordRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	err := h.svc.ChangePassword(r.Context(), user, tokenFrom(r), req.CurrentPassword, req.NewPassword)
	if passwordErr, ok := errors.AsType[PasswordError](err); ok {
		httpx.Error(w, http.StatusUnprocessableEntity, passwordErr.Error())
		return
	}
	if errors.Is(err, ErrChangePasswordWrongCurrent) {
		httpx.Error(w, http.StatusForbidden, err.Error())
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "change password", "err", err, "user_id", user.ID)
		httpx.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
