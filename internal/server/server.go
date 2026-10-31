package server

import (
	"fmt"
	"net/http"
	"time"

	"league-s/internal/app/auth"
	"league-s/internal/config"
	"league-s/internal/database"
)

type Server struct {
	port         int
	corsOrigins  []string
	secureCookie bool
	notifier     auth.Notifier
	adminURL     string

	db database.Service
}

func NewServer(cfg config.Config, db database.Service, notifier auth.Notifier) *http.Server {
	NewServer := &Server{
		port:         cfg.Port,
		corsOrigins:  cfg.CORSOrigins,
		secureCookie: cfg.SecureCookie,
		notifier:     notifier,
		adminURL:     cfg.AdminURL,
		db:           db,
	}

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", NewServer.port),
		Handler:      NewServer.RegisterRoutes(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	return server
}
