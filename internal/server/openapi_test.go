package server

import (
	"bufio"
	"context"
	"net/http"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const openAPIPath = "../../docs/openapi.yaml"

type noDB struct{}

func (noDB) Health(context.Context) error { return nil }
func (noDB) Pool() *pgxpool.Pool          { return nil }
func (noDB) Close()                       {}

var (
	specPathLine   = regexp.MustCompile(`^  (/\S*):\s*$`)
	specMethodLine = regexp.MustCompile(`^    (get|put|post|delete|patch|head|options|trace):\s*$`)
	topLevelKey    = regexp.MustCompile(`^\S`)
)

func routerOperations(t *testing.T) map[string]bool {
	t.Helper()
	router, ok := (&Server{db: noDB{}}).RegisterRoutes().(chi.Routes)
	if !ok {
		t.Fatal("RegisterRoutes does not return a chi router")
	}

	ops := map[string]bool{}
	err := chi.Walk(router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		if len(route) > 1 {
			route = strings.TrimSuffix(route, "/")
		}
		ops[method+" "+route] = true
		return nil
	})
	if err != nil {
		t.Fatalf("walk router: %v", err)
	}
	return ops
}

func specOperations(t *testing.T) map[string]bool {
	t.Helper()
	f, err := os.Open(openAPIPath)
	if err != nil {
		t.Fatalf("open spec: %v", err)
	}
	defer f.Close()

	ops := map[string]bool{}
	inPaths := false
	path := ""
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if topLevelKey.MatchString(line) {
			inPaths = line == "paths:"
			continue
		}
		if !inPaths {
			continue
		}
		if m := specPathLine.FindStringSubmatch(line); m != nil {
			path = m[1]
			continue
		}
		if m := specMethodLine.FindStringSubmatch(line); m != nil {
			ops[strings.ToUpper(m[1])+" "+path] = true
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("read spec: %v", err)
	}
	return ops
}

func TestOpenAPIDescribesEveryRoute(t *testing.T) {
	router := routerOperations(t)
	spec := specOperations(t)

	for op := range router {
		if !spec[op] {
			t.Errorf("%s is in the router but missing from docs/openapi.yaml", op)
		}
	}
	for op := range spec {
		if !router[op] {
			t.Errorf("%s is in docs/openapi.yaml but not in the router", op)
		}
	}
}
