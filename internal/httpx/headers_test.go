package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func serve(t *testing.T, h http.Handler) http.Header {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil))
	return rec.Header()
}

var ok = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

func TestSecurityHeaders_SetsTheHeadersOfEveryResponse(t *testing.T) {
	h := serve(t, SecurityHeaders(ok))

	want := map[string]string{
		"X-Content-Type-Options":  "nosniff",
		"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
		"Referrer-Policy":         "no-referrer",
	}
	for name, value := range want {
		if got := h.Get(name); got != value {
			t.Errorf("%s = %q, want %q", name, got, value)
		}
	}
	if got := h.Get("Cache-Control"); got != "" {
		t.Errorf("Cache-Control = %q, want none", got)
	}
}

func TestContentSecurityPolicy_ReplacesTheAPIPolicy(t *testing.T) {
	const admin = "default-src 'self'"
	h := serve(t, SecurityHeaders(ContentSecurityPolicy(admin)(ok)))

	if got := h.Values("Content-Security-Policy"); len(got) != 1 || got[0] != admin {
		t.Errorf("Content-Security-Policy = %q, want only %q", got, admin)
	}
}

func TestNoStore_ForbidsCaching(t *testing.T) {
	if got := serve(t, NoStore(ok)).Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control = %q, want %q", got, "no-store")
	}
}
