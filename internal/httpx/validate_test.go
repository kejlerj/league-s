package httpx

import (
	"encoding/json"
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

type messageTarget struct {
	Name        string   `json:"name" validate:"required,max=50"`
	Nickname    string   `json:"nickname" validate:"omitempty,min=2"`
	Number      *int32   `json:"number" validate:"omitempty,min=1,max=99"`
	Points      int32    `json:"points" validate:"min=0"`
	Logo        *string  `json:"logo" validate:"omitempty,http_url"`
	HomeTeamID  string   `json:"home_team_id" validate:"omitempty,uuid"`
	AwayTeamID  string   `json:"away_team_id" validate:"omitempty,nefield=HomeTeamID"`
	PlayedOn    string   `json:"played_on" validate:"omitempty,datetime=2006-01-02"`
	StartOn     int32    `json:"start_on"`
	EndOn       int32    `json:"end_on" validate:"omitempty,gtfield=StartOn"`
	TieBreakers []string `json:"tie_breakers" validate:"omitempty,dive,oneof=goal_difference goals_scored"`
	Code        string   `json:"code" validate:"omitempty,alpha"`
	Email       string   `json:"email" validate:"omitempty,email"`
}

func TestDecode_ReadableValidationMessages(t *testing.T) {
	tests := []struct {
		name  string
		body  string
		field string
		want  string
	}{
		{"required", `{}`, "name", "obligatoire"},
		{"text too long", `{"name": "` + strings.Repeat("a", 51) + `"}`, "name", "50 caractères maximum"},
		{"text too short", `{"name": "a", "nickname": "b"}`, "nickname", "2 caractères minimum"},
		{"number too small", `{"name": "a", "number": 0}`, "number", "doit être au moins 1"},
		{"number too large", `{"name": "a", "number": 100}`, "number", "doit être au plus 99"},
		{"negative number", `{"name": "a", "points": -1}`, "points", "doit être au moins 0"},
		{"not an http URL", `{"name": "a", "logo": "javascript:alert(1)"}`, "logo", "doit être une URL http ou https"},
		{"not a UUID", `{"name": "a", "home_team_id": "42"}`, "home_team_id", "doit être un identifiant valide"},
		{"same as another field", `{"name": "a", "home_team_id": "01920c3e-7b1a-7cc2-9d4e-5f6a7b8c9d0e", "away_team_id": "01920c3e-7b1a-7cc2-9d4e-5f6a7b8c9d0e"}`, "away_team_id", "doit être différent de home_team_id"},
		{"not a date", `{"name": "a", "played_on": "01/08/2025"}`, "played_on", "doit être une date au format AAAA-MM-JJ"},
		{"not after another field", `{"name": "a", "start_on": 5, "end_on": 3}`, "end_on", "doit être après start_on"},
		{"not one of the values", `{"name": "a", "tie_breakers": ["coin_toss"]}`, "tie_breakers[0]", "doit valoir goal_difference ou goals_scored"},
		{"not an email", `{"name": "a", "email": "jean"}`, "email", "doit être une adresse e-mail valide"},
		{"unknown tag", `{"name": "a", "code": "a1"}`, "code", "invalide"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()

			var dst messageTarget
			if Decode(rec, req, &dst) {
				t.Fatalf("Decode() = true, want false")
			}
			if rec.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusUnprocessableEntity, rec.Body)
			}

			var got struct {
				Errors map[string]string `json:"errors"`
			}
			if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
				t.Fatalf("decode body: %v", err)
			}
			if got.Errors[tt.field] != tt.want {
				t.Errorf("errors[%q] = %q, want %q (errors = %v)", tt.field, got.Errors[tt.field], tt.want, got.Errors)
			}
		})
	}
}
