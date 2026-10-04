package server

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

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

func (s *Server) RegisterRoutes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(logging.Requests(slog.Default()))
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", s.healthHandler)

	pool := s.db.Pool()

	r.Route("/api/v1", func(r chi.Router) {
		r.Mount("/leagues", league.NewHandler(league.NewPostgresStore(pool)).Routes())
		r.Mount("/leagues/{leagueID}/teams", team.NewHandler(team.NewPostgresStore(pool)).Routes())
		r.Mount("/leagues/{leagueID}/players", player.NewHandler(player.NewPostgresStore(pool)).Routes())
		r.Mount("/leagues/{leagueID}/seasons", season.NewHandler(season.NewPostgresStore(pool)).Routes())

		squadStore := squadmembership.NewPostgresStore(pool)
		squad := squadmembership.NewHandler(squadmembership.NewService(squadStore), squadStore)
		r.Mount("/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad", squad.Routes())
		r.Mount("/leagues/{leagueID}/seasons/{seasonID}/transfers", squad.TransferRoutes())

		matchStore := match.NewPostgresStore(pool)
		r.Mount("/leagues/{leagueID}/seasons/{seasonID}/matches", match.NewHandler(match.NewService(matchStore), matchStore).Routes())
		r.Mount("/leagues/{leagueID}/seasons/{seasonID}/standings", standing.NewHandler(season.NewPostgresStore(pool), matchStore).Routes())
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
