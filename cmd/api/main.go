package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"league-s/internal/app/auth"
	"league-s/internal/config"
	"league-s/internal/database"
	"league-s/internal/logging"
	"league-s/internal/mailer"
	"league-s/internal/server"
)

func gracefulShutdown(apiServer *http.Server, done chan bool) {
	// Create context that listens for the interrupt signal from the OS.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Listen for the interrupt signal.
	<-ctx.Done()

	log.Println("shutting down gracefully, press Ctrl+C again to force")
	stop() // Allow Ctrl+C to force shutdown

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := apiServer.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown with error: %v", err)
	}

	log.Println("Server exiting")

	// Notify the main goroutine that the shutdown is complete
	done <- true
}

func newMailer(cfg config.Config) (auth.Mailer, error) {
	if cfg.SMTP.Host == "" {
		slog.Warn("SMTP_HOST is not set, emails are not sent")
		return mailer.Disabled{}, nil
	}
	return mailer.NewSMTP(cfg.SMTP)
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	slog.SetDefault(logging.New(os.Stdout, cfg.LogFormat, cfg.LogLevel))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	db, err := database.New(ctx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	sender, err := newMailer(cfg)
	if err != nil {
		panic(fmt.Sprintf("mailer: %s", err))
	}
	notifier := auth.EmailNotifier{Mailer: sender, AdminURL: cfg.AdminURL}

	if cfg.SuperadminEmail != "" {
		authSvc := auth.NewService(auth.NewPostgresStore(db.Pool()), notifier)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := authSvc.EnsureSuperadmin(ctx, cfg.SuperadminEmail)
		cancel()
		if err != nil {
			log.Fatalf("superadmin: %v", err)
		}
	}

	server := server.NewServer(cfg, db, notifier)

	// Create a done channel to signal when the shutdown is complete
	done := make(chan bool, 1)

	// Run graceful shutdown in a separate goroutine
	go gracefulShutdown(server, done)

	err = server.ListenAndServe()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		panic(fmt.Sprintf("http server error: %s", err))
	}

	// Wait for the graceful shutdown to complete
	<-done
	log.Println("Graceful shutdown complete.")
}
