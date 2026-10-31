package server

import (
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"league-s/admin"
	"league-s/internal/app/auth"
	"league-s/internal/app/league"
	"league-s/internal/app/match"
	"league-s/internal/app/player"
	"league-s/internal/app/season"
	"league-s/internal/app/squadmembership"
	"league-s/internal/app/standing"
	"league-s/internal/app/team"
	"league-s/internal/httpx"
	"league-s/internal/logging"
)

const adminContentSecurityPolicy = "default-src 'self'; img-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"

func (s *Server) RegisterRoutes() http.Handler {
	r := chi.NewRouter()
	r.Use(httpx.SecurityHeaders)
	r.Use(middleware.ClientIPFromRemoteAddr)
	r.Use(logging.RequestID)
	r.Use(logging.Requests(slog.Default()))
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowOriginFunc: func(_ *http.Request, origin string) bool {
			return slices.Contains(s.corsOrigins, origin)
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", s.healthHandler)
	r.With(httpx.ContentSecurityPolicy(adminContentSecurityPolicy)).Mount("/admin", http.StripPrefix("/admin", admin.Handler()))

	pool := s.db.Pool()

	authStore := auth.NewPostgresStore(pool)
	authSvc := auth.NewService(authStore, s.notifier)
	authHandler := auth.NewHandler(authSvc, authStore, s.secureCookie)
	leagueAdmin := authSvc.LeagueAdminWrites("leagueID")
	loginLimit := httprate.LimitBy(10, time.Minute, func(r *http.Request) (string, error) {
		return httprate.CanonicalizeIP(middleware.GetClientIP(r.Context())), nil
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(authSvc.Identify)

		r.With(loginLimit, httpx.NoStore).Mount("/auth", authHandler.Routes())
		r.Get("/me", authHandler.Me)
		r.Put("/me/password", authHandler.ChangePassword)

		invitations := auth.NewInvitationHandler(auth.NewInvitations(authStore), authStore, s.adminURL)
		r.With(loginLimit, httpx.NoStore).Mount("/invitations", invitations.Routes())
		r.With(auth.Superadmin).Mount("/leagues/{leagueID}/invitations", invitations.LeagueRoutes())
		r.With(authSvc.LeagueAdmin("leagueID")).Mount("/leagues/{leagueID}/admins", invitations.AdminRoutes())

		leagues := league.NewHandler(league.NewPostgresStore(pool))
		r.With(leagueAdmin).Patch("/leagues/{leagueID}", leagues.Update)
		r.With(auth.SuperadminWrites).Mount("/leagues", leagues.Routes())
		r.With(leagueAdmin).Mount("/leagues/{leagueID}/teams", team.NewHandler(team.NewPostgresStore(pool)).Routes())
		r.With(leagueAdmin).Mount("/leagues/{leagueID}/players", player.NewHandler(player.NewPostgresStore(pool)).Routes())
		seasonStore := season.NewPostgresStore(pool)
		seasons := season.NewHandler(seasonStore)
		r.With(leagueAdmin).Mount("/leagues/{leagueID}/seasons", seasons.Routes())
		r.Mount("/leagues/{leagueID}/teams/{teamID}/seasons", seasons.TeamRoutes())

		squadStore := squadmembership.NewPostgresStore(pool)
		squad := squadmembership.NewHandler(squadmembership.NewService(squadStore), squadStore)
		r.With(leagueAdmin).Mount("/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad", squad.Routes())
		r.With(leagueAdmin).Mount("/leagues/{leagueID}/seasons/{seasonID}/transfers", squad.TransferRoutes())
		r.Mount("/leagues/{leagueID}/players/{playerID}/career", squad.CareerRoutes())

		matchStore := match.NewPostgresStore(pool)
		r.With(leagueAdmin).Mount("/leagues/{leagueID}/seasons/{seasonID}/matches", match.NewHandler(match.NewService(matchStore), matchStore, seasonStore).Routes())
		r.Mount("/leagues/{leagueID}/seasons/{seasonID}/standings", standing.NewHandler(seasonStore, matchStore).Routes())
	})

	return r
}

func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Health(r.Context()); err != nil {
		slog.ErrorContext(r.Context(), "health check", "err", err)
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"status": "down"})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"status": "up"})
}
