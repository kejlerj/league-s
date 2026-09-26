package player

type Player struct {
	ID        int64
	Firstname string
	Lastname  string
}

type SquadPlayer struct {
	Player
	Number *int32
}
