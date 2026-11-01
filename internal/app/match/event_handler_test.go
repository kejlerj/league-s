//go:build integration

package match

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"league-s/internal/app/auth"
	"league-s/internal/app/season"
	"league-s/internal/db"
	"league-s/internal/testdb"
	"league-s/internal/testhttp"
)

type everyoneIsAdmin struct{}

func (everyoneIsAdmin) CanWrite(context.Context, *auth.User, uuid.UUID) (bool, error) {
	return true, nil
}

type eventFixture struct {
	fixture
	homePlayer, homeOther, homeLeft db.Player
	awayPlayer                      db.Player
}

func newEventFixture(t *testing.T) eventFixture {
	t.Helper()
	f := newFixture(t)
	store := NewPostgresStore(testPool)
	svc := NewService(store)

	r := chi.NewRouter()
	r.Mount("/api/v1/leagues/{leagueID}/seasons/{seasonID}/matches", NewHandler(svc, store, season.NewPostgresStore(testPool)).Routes())
	r.Mount("/api/v1/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/events", NewEventHandler(svc, store, everyoneIsAdmin{}).Routes())
	f.router = r

	ef := eventFixture{
		fixture:    f,
		homePlayer: f.seed.CreatePlayer(testdb.PlayerParams{Firstname: "Malik", Lastname: "Diarra"}),
		homeOther:  f.seed.CreatePlayer(testdb.PlayerParams{Firstname: "Léo", Lastname: "Dupont"}),
		homeLeft:   f.seed.CreatePlayer(testdb.PlayerParams{}),
		awayPlayer: f.seed.CreatePlayer(testdb.PlayerParams{}),
	}
	f.seed.CreateSquadMember(testdb.SquadMemberParams{Season: f.season, Team: f.home, Player: ef.homePlayer})
	f.seed.CreateSquadMember(testdb.SquadMemberParams{Season: f.season, Team: f.home, Player: ef.homeOther})
	f.seed.CreateSquadMember(testdb.SquadMemberParams{Season: f.season, Team: f.home, Player: ef.homeLeft, LeftOn: "2025-10-03"})
	f.seed.CreateSquadMember(testdb.SquadMemberParams{Season: f.season, Team: f.away, Player: ef.awayPlayer})
	return ef
}

func (f eventFixture) liveMatch(t *testing.T) uuid.UUID {
	t.Helper()
	m := f.schedule(t, f.home, f.away, 1)
	f.do(t, http.MethodPost, f.matchPath(m.ID, "/start"), "", http.StatusOK)
	return m.ID
}

func (f eventFixture) eventsPath(matchID uuid.UUID) string {
	return f.matchPath(matchID, "/events")
}

func (f eventFixture) record(t *testing.T, matchID uuid.UUID, body string, wantStatus int) eventResponse {
	t.Helper()
	rec := testhttp.Do(t, f.router, http.MethodPost, f.eventsPath(matchID), body)
	if rec.Code != wantStatus {
		t.Fatalf("POST events: status = %d, want %d, body = %s", rec.Code, wantStatus, rec.Body)
	}
	if wantStatus != http.StatusCreated {
		return eventResponse{}
	}
	return decode[eventResponse](t, rec)
}

func (f eventFixture) events(t *testing.T, matchID uuid.UUID) []eventResponse {
	t.Helper()
	rec := testhttp.Do(t, f.router, http.MethodGet, f.eventsPath(matchID), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET events: status = %d, body = %s", rec.Code, rec.Body)
	}
	return decode[[]eventResponse](t, rec)
}

func goalBody(teamID uuid.UUID, minute int, extra string) string {
	return fmt.Sprintf(`{"type": "goal", "team_id": %q, "minute": %d%s}`, teamID, minute, extra)
}

func playerBody(typ string, teamID, playerID uuid.UUID, minute int) string {
	return fmt.Sprintf(`{"type": %q, "team_id": %q, "minute": %d, "player_id": %q}`, typ, teamID, minute, playerID)
}

func TestRecordGoal_OnALiveMatchFollowsTheScore(t *testing.T) {
	f := newEventFixture(t)
	matchID := f.liveMatch(t)

	created := f.record(t, matchID, goalBody(f.home.ID, 37, fmt.Sprintf(`, "player_id": %q, "assist_player_id": %q`, f.homePlayer.ID, f.homeOther.ID)), http.StatusCreated)
	switch {
	case created.ID == uuid.Nil || created.MatchID != matchID || created.TeamID != f.home.ID || created.Type != EventGoal || created.Minute != 37:
		t.Errorf("event = %+v, want a home goal at 37'", created)
	case created.Player == nil || created.Player.Firstname != "Malik" || created.Player.Lastname != "Diarra":
		t.Errorf("player = %+v, want Malik Diarra", created.Player)
	case created.AssistPlayer == nil || created.AssistPlayer.ID != f.homeOther.ID || created.AssistPlayer.Firstname != "Léo":
		t.Errorf("assist = %+v, want Léo Dupont", created.AssistPlayer)
	case created.PlayerIn != nil || created.Note != nil || created.SentOff:
		t.Errorf("event = %+v, want no player in, note or sending-off", created)
	case created.HomeScore == nil || *created.HomeScore != 1 || *created.AwayScore != 0:
		t.Errorf("running score = %v-%v, want 1-0", created.HomeScore, created.AwayScore)
	}

	if m := f.do(t, http.MethodGet, f.matchPath(matchID, ""), "", http.StatusOK); *m.HomeScore != 1 || *m.AwayScore != 0 {
		t.Errorf("match score = %d-%d, want 1-0", *m.HomeScore, *m.AwayScore)
	}

	if rec := testhttp.Do(t, f.router, http.MethodDelete, f.eventsPath(matchID)+"/"+created.ID.String(), ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE event: status = %d, body = %s", rec.Code, rec.Body)
	}
	if m := f.do(t, http.MethodGet, f.matchPath(matchID, ""), "", http.StatusOK); *m.HomeScore != 0 || *m.AwayScore != 0 {
		t.Errorf("match score after delete = %d-%d, want 0-0", *m.HomeScore, *m.AwayScore)
	}
	if events := f.events(t, matchID); len(events) != 0 {
		t.Errorf("events after delete = %d, want 0", len(events))
	}
}

func TestRecordGoal_OnAFinishedMatchFillsInTheScorers(t *testing.T) {
	f := newEventFixture(t)
	kickoff := time.Date(2025, time.October, 4, 18, 0, 0, 0, time.UTC)
	matchID := f.seed.CreateMatch(testdb.MatchParams{Season: f.season, Home: f.home, Away: f.away, KickoffAt: &kickoff, Status: db.MatchStatusFinished, Score: &testdb.Score{Home: 1, Away: 0}})

	f.record(t, matchID, goalBody(f.home.ID, 12, fmt.Sprintf(`, "player_id": %q`, f.homePlayer.ID)), http.StatusCreated)

	rec := testhttp.Do(t, f.router, http.MethodPost, f.eventsPath(matchID), goalBody(f.home.ID, 50, ""))
	if rec.Code != http.StatusConflict {
		t.Errorf("a goal over the score: status = %d, want %d, body = %s", rec.Code, http.StatusConflict, rec.Body)
	}
	if m := f.do(t, http.MethodGet, f.matchPath(matchID, ""), "", http.StatusOK); m.Status != StatusFinished || *m.HomeScore != 1 || *m.AwayScore != 0 {
		t.Errorf("match = %+v, want finished at 1-0", m)
	}
}

func TestSetScore_CannotGoBelowTheGoalEvents(t *testing.T) {
	f := newEventFixture(t)
	matchID := f.liveMatch(t)
	f.record(t, matchID, goalBody(f.home.ID, 10, ""), http.StatusCreated)
	f.record(t, matchID, goalBody(f.home.ID, 20, ""), http.StatusCreated)

	rec := testhttp.Do(t, f.router, http.MethodPut, f.matchPath(matchID, "/score"), `{"home": 1, "away": 0}`)
	if rec.Code != http.StatusConflict {
		t.Errorf("score below the goal events: status = %d, want %d, body = %s", rec.Code, http.StatusConflict, rec.Body)
	}
	if m := f.do(t, http.MethodPut, f.matchPath(matchID, "/score"), `{"home": 3, "away": 1}`, http.StatusOK); *m.HomeScore != 3 || *m.AwayScore != 1 {
		t.Errorf("score = %d-%d, want 3-1", *m.HomeScore, *m.AwayScore)
	}
}

func TestListEvents_ByMinuteWithTheReadModel(t *testing.T) {
	f := newEventFixture(t)
	matchID := f.liveMatch(t)
	f.record(t, matchID, playerBody("yellow_card", f.away.ID, f.awayPlayer.ID, 70), http.StatusCreated)
	f.record(t, matchID, goalBody(f.away.ID, 5, ""), http.StatusCreated)
	f.record(t, matchID, playerBody("yellow_card", f.away.ID, f.awayPlayer.ID, 30), http.StatusCreated)
	f.record(t, matchID, goalBody(f.home.ID, 40, fmt.Sprintf(`, "player_id": %q, "own_goal": true`, f.awayPlayer.ID)), http.StatusCreated)
	f.record(t, matchID, fmt.Sprintf(`{"type": "substitution", "team_id": %q, "minute": 60, "player_id": %q, "player_in_id": %q}`, f.home.ID, f.homePlayer.ID, f.homeOther.ID), http.StatusCreated)
	f.record(t, matchID, fmt.Sprintf(`{"type": "injury", "team_id": %q, "minute": 59, "player_id": %q, "note": " Cheville "}`, f.home.ID, f.homePlayer.ID), http.StatusCreated)

	got := f.events(t, matchID)

	type row struct {
		minute  int32
		typ     EventType
		sentOff bool
		score   string
	}
	want := []row{
		{5, EventGoal, false, "0-1"},
		{30, EventYellowCard, false, ""},
		{40, EventGoal, false, "1-1"},
		{59, EventInjury, false, ""},
		{60, EventSubstitution, false, ""},
		{70, EventYellowCard, true, ""},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d events, want %d", len(got), len(want))
	}
	for i, w := range want {
		e := got[i]
		score := ""
		if e.HomeScore != nil {
			score = fmt.Sprintf("%d-%d", *e.HomeScore, *e.AwayScore)
		}
		if e.Minute != w.minute || e.Type != w.typ || e.SentOff != w.sentOff || score != w.score {
			t.Errorf("event %d = %d' %s sent off %v score %q, want %+v", i, e.Minute, e.Type, e.SentOff, score, w)
		}
	}
	if !got[2].OwnGoal || got[2].Player == nil || got[2].Player.ID != f.awayPlayer.ID {
		t.Errorf("own goal = %+v, want scored by the away player", got[2])
	}
	if got[4].PlayerIn == nil || got[4].PlayerIn.ID != f.homeOther.ID {
		t.Errorf("substitution = %+v, want Léo Dupont coming in", got[4])
	}
	if got[3].Note != nil {
		t.Errorf("injury note = %q, want it hidden from a public reader", *got[3].Note)
	}
}

func TestRecordInjury_NoteIsTrimmedAndReturnedToTheAdmin(t *testing.T) {
	f := newEventFixture(t)
	matchID := f.liveMatch(t)

	withNote := f.record(t, matchID, fmt.Sprintf(`{"type": "injury", "team_id": %q, "minute": 71, "player_id": %q, "note": "  Cheville "}`, f.home.ID, f.homePlayer.ID), http.StatusCreated)
	if withNote.Note == nil || *withNote.Note != "Cheville" {
		t.Errorf("note = %v, want Cheville", withNote.Note)
	}
	withoutNote := f.record(t, matchID, playerBody("injury", f.home.ID, f.homeOther.ID, 72), http.StatusCreated)
	if withoutNote.Note != nil {
		t.Errorf("note = %q, want null", *withoutNote.Note)
	}
}

func TestRecordEvent_Errors(t *testing.T) {
	tests := []struct {
		name       string
		body       func(f eventFixture) string
		wantStatus int
		wantField  string
	}{
		{"invalid JSON", func(eventFixture) string { return `{"type":` }, http.StatusBadRequest, ""},
		{"unknown type", func(f eventFixture) string {
			return fmt.Sprintf(`{"type": "corner", "team_id": %q, "minute": 5}`, f.home.ID)
		}, http.StatusUnprocessableEntity, "type"},
		{"no minute", func(f eventFixture) string { return fmt.Sprintf(`{"type": "goal", "team_id": %q}`, f.home.ID) }, http.StatusUnprocessableEntity, "minute"},
		{"minute 151", func(f eventFixture) string { return goalBody(f.home.ID, 151, "") }, http.StatusUnprocessableEntity, "minute"},
		{"team of another match", func(f eventFixture) string { return goalBody(f.third.ID, 5, "") }, http.StatusUnprocessableEntity, "team_id"},
		{"card without a player", func(f eventFixture) string {
			return fmt.Sprintf(`{"type": "red_card", "team_id": %q, "minute": 5}`, f.home.ID)
		}, http.StatusUnprocessableEntity, "player_id"},
		{"player of the other team", func(f eventFixture) string { return playerBody("yellow_card", f.home.ID, f.awayPlayer.ID, 5) }, http.StatusUnprocessableEntity, "player_id"},
		{"player who left before the match day", func(f eventFixture) string { return playerBody("yellow_card", f.home.ID, f.homeLeft.ID, 5) }, http.StatusUnprocessableEntity, "player_id"},
		{"assist on a penalty", func(f eventFixture) string {
			return goalBody(f.home.ID, 5, fmt.Sprintf(`, "player_id": %q, "assist_player_id": %q, "penalty": true`, f.homePlayer.ID, f.homeOther.ID))
		}, http.StatusUnprocessableEntity, "assist_player_id"},
		{"assist of the other team", func(f eventFixture) string {
			return goalBody(f.home.ID, 5, fmt.Sprintf(`, "player_id": %q, "assist_player_id": %q`, f.homePlayer.ID, f.awayPlayer.ID))
		}, http.StatusUnprocessableEntity, "assist_player_id"},
		{"note on a card", func(f eventFixture) string {
			return fmt.Sprintf(`{"type": "yellow_card", "team_id": %q, "minute": 5, "player_id": %q, "note": "Cheville"}`, f.home.ID, f.homePlayer.ID)
		}, http.StatusUnprocessableEntity, "note"},
		{"substitution by the same player", func(f eventFixture) string {
			return fmt.Sprintf(`{"type": "substitution", "team_id": %q, "minute": 60, "player_id": %q, "player_in_id": %q}`, f.home.ID, f.homePlayer.ID, f.homePlayer.ID)
		}, http.StatusUnprocessableEntity, "player_in_id"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newEventFixture(t)
			matchID := f.liveMatch(t)

			rec := testhttp.Do(t, f.router, http.MethodPost, f.eventsPath(matchID), tt.body(f))
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
			if tt.wantField != "" {
				var body struct {
					Errors map[string]string `json:"errors"`
				}
				if err := json.NewDecoder(rec.Body).Decode(&body); err != nil || body.Errors[tt.wantField] == "" {
					t.Errorf("errors = %v (%v), want one on %s", body.Errors, err, tt.wantField)
				}
			}
			if events := f.events(t, matchID); len(events) != 0 {
				t.Errorf("%d events stored, want none", len(events))
			}
		})
	}
}

func TestRecordEvent_PlayerNotInSquadMessage(t *testing.T) {
	f := newEventFixture(t)
	matchID := f.liveMatch(t)

	rec := testhttp.Do(t, f.router, http.MethodPost, f.eventsPath(matchID), playerBody("yellow_card", f.home.ID, f.awayPlayer.ID, 5))
	var body struct {
		Errors map[string]string `json:"errors"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got := body.Errors["player_id"]; got != "n'est pas dans l'effectif de l'équipe ce jour-là" {
		t.Errorf("player_id error = %q", got)
	}
}

func TestRecordEvent_Conflicts(t *testing.T) {
	t.Run("a scheduled match", func(t *testing.T) {
		f := newEventFixture(t)
		m := f.schedule(t, f.home, f.away, 1)
		f.record(t, m.ID, goalBody(f.home.ID, 5, ""), http.StatusConflict)
	})

	t.Run("a player sent off", func(t *testing.T) {
		f := newEventFixture(t)
		matchID := f.liveMatch(t)
		f.record(t, matchID, playerBody("red_card", f.home.ID, f.homePlayer.ID, 30), http.StatusCreated)
		f.record(t, matchID, playerBody("yellow_card", f.home.ID, f.homePlayer.ID, 40), http.StatusConflict)
	})
}

func TestEvents_AreNotReachableFromAnotherLeagueOrSeason(t *testing.T) {
	f := newEventFixture(t)
	matchID := f.liveMatch(t)
	created := f.record(t, matchID, goalBody(f.home.ID, 5, ""), http.StatusCreated)
	other := f.seed.CreateLeague(testdb.LeagueParams{})
	otherSeason := f.seed.CreateSeason(testdb.SeasonParams{StartOn: "2026-08-01", EndOn: "2027-05-31"})

	for _, base := range []string{
		fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/matches/%s/events", other.ID, f.season.ID, matchID),
		fmt.Sprintf("/api/v1/leagues/%s/seasons/%s/matches/%s/events", f.season.LeagueID, otherSeason.ID, matchID),
	} {
		requests := []struct {
			method string
			path   string
			body   string
		}{
			{http.MethodGet, base, ""},
			{http.MethodPost, base, goalBody(f.home.ID, 6, "")},
			{http.MethodDelete, base + "/" + created.ID.String(), ""},
		}
		for _, rq := range requests {
			if rec := testhttp.Do(t, f.router, rq.method, rq.path, rq.body); rec.Code != http.StatusNotFound {
				t.Errorf("%s %s: status = %d, want %d", rq.method, rq.path, rec.Code, http.StatusNotFound)
			}
		}
	}

	if events := f.events(t, matchID); len(events) != 1 {
		t.Errorf("events = %d, want the one recorded", len(events))
	}
}

func TestDeleteEvent_OfAnotherMatch(t *testing.T) {
	f := newEventFixture(t)
	matchID := f.liveMatch(t)
	created := f.record(t, matchID, goalBody(f.home.ID, 5, ""), http.StatusCreated)
	otherMatch := f.schedule(t, f.third, f.home, 2)
	f.do(t, http.MethodPost, f.matchPath(otherMatch.ID, "/start"), "", http.StatusOK)

	if rec := testhttp.Do(t, f.router, http.MethodDelete, f.eventsPath(otherMatch.ID)+"/"+created.ID.String(), ""); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
	if rec := testhttp.Do(t, f.router, http.MethodDelete, f.eventsPath(matchID)+"/"+uuid.NewString(), ""); rec.Code != http.StatusNotFound {
		t.Errorf("unknown event: status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}
