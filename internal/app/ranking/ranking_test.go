package ranking

import (
	"testing"

	"github.com/google/uuid"

	"league-s/internal/app/match"
)

type person struct {
	match.PlayerName
}

func newPerson(firstname, lastname string) person {
	return person{match.PlayerName{ID: uuid.New(), Firstname: firstname, Lastname: lastname}}
}

func (p person) name() *match.PlayerName {
	return new(p.PlayerName)
}

func goal(teamID uuid.UUID, scorer, assist *person) match.EventView {
	v := match.EventView{ID: uuid.New(), TeamID: teamID, Type: match.EventGoal, Minute: 10}
	if scorer != nil {
		v.PlayerID, v.Player = new(scorer.ID), scorer.name()
	}
	if assist != nil {
		v.AssistPlayerID, v.AssistPlayer = new(assist.ID), assist.name()
	}
	return v
}

func ownGoal(teamID uuid.UUID, scorer person) match.EventView {
	v := goal(teamID, &scorer, nil)
	v.OwnGoal = true
	return v
}

type want struct {
	rank   int
	player person
	team   uuid.UUID
	value  int32
}

func check(t *testing.T, got []Row, wants []want) {
	t.Helper()
	if len(got) != len(wants) {
		t.Fatalf("got %d rows (%+v), want %d", len(got), got, len(wants))
	}
	for i, w := range wants {
		g := got[i]
		if g.Rank != w.rank || g.PlayerID != w.player.ID || g.Firstname != w.player.Firstname || g.Lastname != w.player.Lastname || g.TeamID != w.team || g.Value != w.value {
			t.Errorf("row %d = %+v, want rank %d %s %s of %s with %d", i, g, w.rank, w.player.Firstname, w.player.Lastname, w.team, w.value)
		}
	}
}

func TestScorers(t *testing.T) {
	home, away := uuid.New(), uuid.New()
	diarra, dupont, martin, petit := newPerson("Malik", "Diarra"), newPerson("Léo", "Dupont"), newPerson("Anne", "Martin"), newPerson("Zoé", "Petit")

	events := []match.EventView{
		goal(home, &diarra, &dupont),
		goal(home, &dupont, nil),
		goal(away, &martin, nil),
		goal(home, nil, &diarra),
		ownGoal(away, diarra),
		goal(away, &martin, nil),
		goal(home, &diarra, nil),
		ownGoal(home, petit),
	}

	check(t, Scorers(events), []want{
		{1, diarra, home, 2},
		{1, martin, away, 2},
		{3, dupont, home, 1},
	})
}

func TestAssists(t *testing.T) {
	home := uuid.New()
	diarra, dupont, martin := newPerson("Malik", "Diarra"), newPerson("Léo", "Dupont"), newPerson("Anne", "Martin")

	events := []match.EventView{
		goal(home, &diarra, &dupont),
		goal(home, &diarra, &martin),
		goal(home, nil, &dupont),
		goal(home, &dupont, nil),
	}

	check(t, Assists(events), []want{
		{1, dupont, home, 2},
		{2, martin, home, 1},
	})
}

func TestRanking_TiesAreSortedByLastNameThenFirstName(t *testing.T) {
	team := uuid.New()
	annaB, zoeA, annaA := newPerson("Anna", "Bernard"), newPerson("Zoé", "Adam"), newPerson("Anna", "Adam")

	check(t, Scorers([]match.EventView{goal(team, &annaB, nil), goal(team, &zoeA, nil), goal(team, &annaA, nil)}), []want{
		{1, annaA, team, 1},
		{1, zoeA, team, 1},
		{1, annaB, team, 1},
	})
}

func TestRanking_TransferredPlayerShowsOnceWithTheTeamOfTheLastGoalOrAssist(t *testing.T) {
	before, after := uuid.New(), uuid.New()
	diarra, dupont := newPerson("Malik", "Diarra"), newPerson("Léo", "Dupont")

	events := []match.EventView{
		goal(before, &diarra, nil),
		goal(before, &diarra, nil),
		goal(after, &dupont, &diarra),
	}

	check(t, Scorers(events), []want{
		{1, diarra, after, 2},
		{2, dupont, after, 1},
	})
}

func TestRanking_Empty(t *testing.T) {
	if got := Scorers(nil); len(got) != 0 {
		t.Errorf("Scorers(nil) = %v, want none", got)
	}
	if got := Assists([]match.EventView{goal(uuid.New(), nil, nil)}); len(got) != 0 {
		t.Errorf("Assists() = %v, want none", got)
	}
}
