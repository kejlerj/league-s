package httpx

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func requestWithParam(t *testing.T, name, value string) *http.Request {
	t.Helper()
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(name, value)
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestIDParam(t *testing.T) {
	const canonical = "01920c3e-7b1a-7cc2-9d4e-5f6a7b8c9d0e"

	t.Run("canonical form", func(t *testing.T) {
		id, err := IDParam(requestWithParam(t, "id", canonical), "id")
		if err != nil {
			t.Fatalf("IDParam() error = %v, want nil", err)
		}
		if id != uuid.MustParse(canonical) {
			t.Errorf("IDParam() = %s, want %s", id, canonical)
		}
	})

	rejected := []struct {
		name  string
		value string
	}{
		{"empty", ""},
		{"integer", "42"},
		{"not hexadecimal", "0192zzzz-7b1a-7cc2-9d4e-5f6a7b8c9d0e"},
		{"urn prefix", "urn:uuid:" + canonical},
		{"braces", "{" + canonical + "}"},
		{"no dashes", "01920c3e7b1a7cc29d4e5f6a7b8c9d0e"},
	}

	for _, tt := range rejected {
		t.Run(tt.name, func(t *testing.T) {
			_, err := IDParam(requestWithParam(t, "id", tt.value), "id")
			if !errors.Is(err, ErrInvalidID) {
				t.Errorf("IDParam(%q) error = %v, want ErrInvalidID", tt.value, err)
			}
		})
	}
}
