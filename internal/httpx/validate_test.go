package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type decodeTarget struct {
	Name string `json:"name" validate:"required,max=50"`
}

func TestDecode(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantOK     bool
		wantStatus int
	}{
		{"valid body", `{"name": "Les Bleus"}`, true, http.StatusOK},
		{"invalid JSON", `{"name":`, false, http.StatusBadRequest},
		{"unknown field", `{"name": "Les Bleus", "league_id": 7}`, false, http.StatusBadRequest},
		{"body too large", `{"name": "` + strings.Repeat("a", maxBodyBytes) + `"}`, false, http.StatusRequestEntityTooLarge},
		{"failed validation", `{}`, false, http.StatusUnprocessableEntity},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()

			var dst decodeTarget
			ok := Decode(rec, req, &dst)

			if ok != tt.wantOK {
				t.Errorf("ok = %v, want %v, body = %s", ok, tt.wantOK, rec.Body)
			}
			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
		})
	}
}
