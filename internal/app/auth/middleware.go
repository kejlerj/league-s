package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/httpx"
)

const CookieName = "session"

type userKey struct{}

func UserFrom(ctx context.Context) (*User, bool) {
	u, ok := ctx.Value(userKey{}).(*User)
	return u, ok
}

func tokenFrom(r *http.Request) string {
	if c, err := r.Cookie(CookieName); err == nil && c.Value != "" {
		return c.Value
	}
	if token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok {
		return token
	}
	return ""
}

func (s *Service) Identify(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := tokenFrom(r)
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}

		user, err := s.Authenticate(r.Context(), token)
		if errors.Is(err, ErrSessionNotFound) {
			next.ServeHTTP(w, r)
			return
		}
		if err != nil {
			slog.ErrorContext(r.Context(), "authenticate request", "err", err)
			httpx.Error(w, http.StatusInternalServerError, "internal error")
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey{}, user)))
	})
}

func isRead(r *http.Request) bool {
	return r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions
}

func (s *Service) LeagueAdminWrites(leagueParam string) func(http.Handler) http.Handler {
	return s.leagueAdmin(leagueParam, false)
}

func (s *Service) LeagueAdmin(leagueParam string) func(http.Handler) http.Handler {
	return s.leagueAdmin(leagueParam, true)
}

func (s *Service) leagueAdmin(leagueParam string, guardReads bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !guardReads && isRead(r) {
				next.ServeHTTP(w, r)
				return
			}

			user, ok := UserFrom(r.Context())
			if !ok {
				httpx.Error(w, http.StatusUnauthorized, "authentication required")
				return
			}
			if user.IsSuperadmin {
				next.ServeHTTP(w, r)
				return
			}

			leagueID, err := uuid.Parse(chi.URLParam(r, leagueParam))
			if err != nil {
				httpx.Error(w, http.StatusForbidden, "not an admin of this league")
				return
			}

			allowed, err := s.CanWrite(r.Context(), user, leagueID)
			if err != nil {
				slog.ErrorContext(r.Context(), "authorize request", "err", err, "user_id", user.ID, "league_id", leagueID)
				httpx.Error(w, http.StatusInternalServerError, "internal error")
				return
			}
			if !allowed {
				httpx.Error(w, http.StatusForbidden, "not an admin of this league")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func SuperadminWrites(next http.Handler) http.Handler {
	return superadmin(next, false)
}

func Superadmin(next http.Handler) http.Handler {
	return superadmin(next, true)
}

func superadmin(next http.Handler, guardReads bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !guardReads && isRead(r) {
			next.ServeHTTP(w, r)
			return
		}

		user, ok := UserFrom(r.Context())
		if !ok {
			httpx.Error(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if !user.IsSuperadmin {
			httpx.Error(w, http.StatusForbidden, "superadmin only")
			return
		}

		next.ServeHTTP(w, r)
	})
}
