# Simple Makefile for a Go project

-include .env
DB_URL=postgres://$(DB_USERNAME):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_DATABASE)?sslmode=disable

migrate-up:
	@goose -dir migrations postgres "$(DB_URL)" up

migrate-down:
	@goose -dir migrations postgres "$(DB_URL)" down

migrate-status:
	@goose -dir migrations postgres "$(DB_URL)" status

migrate-reset:
	@goose -dir migrations postgres "$(DB_URL)" reset

# Build the application
all: build test

build:
	@npm --prefix admin run build
	@go build -o main ./cmd/api

# Run the application
run:
	@go run cmd/api/main.go

dev-up:
	@docker compose up -d --wait
	@$(MAKE) migrate-up
	@$(MAKE) run

seed:
	@go run ./cmd/seed

e2e:
	@docker compose up -d --wait
	@$(MAKE) e2e-run

e2e-run:
	@$(MAKE) migrate-up
	@$(MAKE) build
	@go run ./cmd/seed
	@PORT=$(PORT) npm --prefix admin run e2e

# Create DB container
docker-run:
	@if docker compose up --build 2>/dev/null; then \
		: ; \
	else \
		echo "Falling back to Docker Compose V1"; \
		docker-compose up --build; \
	fi

# Shutdown DB container
docker-down:
	@if docker compose down 2>/dev/null; then \
		: ; \
	else \
		echo "Falling back to Docker Compose V1"; \
		docker-compose down; \
	fi

test:
	@go tool gotestsum --format testdox -- ./...

itest:
	@go tool gotestsum --format testdox -- -tags=integration ./...

lint:
	@golangci-lint run

fmt:
	@golangci-lint fmt

vuln:
	@go tool govulncheck ./...

# Clean the binary
clean:
	@echo "Cleaning..."
	@rm -f main

# Live Reload
watch:
	@if command -v air > /dev/null; then \
            air; \
            echo "Watching...";\
        else \
            read -p "Go's 'air' is not installed on your machine. Do you want to install it? [Y/n] " choice; \
            if [ "$$choice" != "n" ] && [ "$$choice" != "N" ]; then \
                go install github.com/air-verse/air@latest; \
                air; \
                echo "Watching...";\
            else \
                echo "You chose not to install air. Exiting..."; \
                exit 1; \
            fi; \
        fi

.PHONY: all build run dev-up seed e2e e2e-run test itest lint fmt vuln clean watch docker-run docker-down migrate-up migrate-down migrate-status migrate-reset
