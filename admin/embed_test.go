package admin

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestHandler(t *testing.T) {
	files := fstest.MapFS{
		"index.html":       {Data: []byte("<html>admin</html>")},
		"favicon.svg":      {Data: []byte("<svg/>")},
		"assets/index.js":  {Data: []byte("console.log('admin')")},
		"assets/index.css": {Data: []byte("body{}")},
	}
	h := http.StripPrefix("/admin", handler(files))

	tests := []struct {
		name      string
		path      string
		wantCode  int
		wantBody  string
		wantCache string
	}{
		{"root", "/admin/", http.StatusOK, "<html>admin</html>", "no-cache"},
		{"root without the slash", "/admin", http.StatusOK, "<html>admin</html>", "no-cache"},
		{"page of the app", "/admin/leagues/42/teams", http.StatusOK, "<html>admin</html>", "no-cache"},
		{"page with a token", "/admin/invitation?token=abc", http.StatusOK, "<html>admin</html>", "no-cache"},
		{"asset", "/admin/assets/index.js", http.StatusOK, "console.log('admin')", "public, max-age=31536000, immutable"},
		{"other file", "/admin/favicon.svg", http.StatusOK, "<svg/>", ""},
		{"missing asset", "/admin/assets/old.js", http.StatusNotFound, "", ""},
		{"path outside the build", "/admin/../../etc/passwd", http.StatusBadRequest, "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, tt.path, nil))

			if rec.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantCode)
			}
			if tt.wantBody != "" && rec.Body.String() != tt.wantBody {
				t.Errorf("body = %q, want %q", rec.Body, tt.wantBody)
			}
			if tt.wantCode == http.StatusOK && rec.Header().Get("Cache-Control") != tt.wantCache {
				t.Errorf("Cache-Control = %q, want %q", rec.Header().Get("Cache-Control"), tt.wantCache)
			}
			if rec.Header().Get("X-Frame-Options") != "DENY" {
				t.Errorf("X-Frame-Options = %q, want DENY", rec.Header().Get("X-Frame-Options"))
			}
		})
	}
}

func TestHandler_WithoutABuild(t *testing.T) {
	rec := httptest.NewRecorder()
	handler(fstest.MapFS{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d when the admin has not been built", rec.Code, http.StatusNotFound)
	}
}

func TestHandler_ServesTheEmbeddedBuild(t *testing.T) {
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil))

	if rec.Code == http.StatusOK && !strings.Contains(rec.Body.String(), "<html") {
		t.Errorf("body = %q, want the index page of the build", rec.Body)
	}
}
