package player

import (
	"context"
	"league-s/internal/db"
)

type PostgresStore struct {
	q *db.Queries
}

func NewPostgresStore(q *db.Queries) *PostgresStore { return &PostgresStore{q: q} }

func (s *PostgresStore) Create(ctx context.Context, player *Player) error {
	_, err := s.q.CreatePlayer(ctx, db.CreatePlayerParams{
		Firstname: player.Firstname,
		Lastname:  player.Lastname,
	})
	return err
}

func (s *PostgresStore) Get(ctx context.Context, id int64) (*Player, error) {
	player, err := s.q.GetPlayerByID(ctx, id)

	if err != nil {
		return nil, err
	}

	return &Player{
		ID:        player.ID,
		Firstname: player.Firstname,
		Lastname:  player.Lastname,
	}, nil
}

// GetByTeamAndSeason returns the players currently in a team's squad for a season.
func (s *PostgresStore) GetByTeamAndSeason(ctx context.Context, teamID, seasonID int64) ([]*SquadPlayer, error) {
	players, err := s.q.GetPlayersByTeamAndSeason(ctx, db.GetPlayersByTeamAndSeasonParams{
		TeamID:   teamID,
		SeasonID: seasonID,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*SquadPlayer, len(players))
	for i, p := range players {
		result[i] = &SquadPlayer{
			Player: Player{
				ID:        p.Player.ID,
				Firstname: p.Player.Firstname,
				Lastname:  p.Player.Lastname,
			},
			Number: p.Number,
		}
	}

	return result, nil
}
