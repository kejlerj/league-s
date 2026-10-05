package server

import (
	"fmt"
	"net/http"
	"time"

	"league-s/internal/database"
)

type Server struct {
	port int

	db database.Service
}

func NewServer(port int, db database.Service) *http.Server {
	NewServer := &Server{
		port: port,
		db:   db,
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
