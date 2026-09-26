
-- name: CreatePlayer :one
INSERT INTO player (firstname, lastname) 
VALUES ($1, $2) 
RETURNING *;

-- name: GetPlayerByID :one
SELECT * FROM player WHERE id = $1;

-- name: GetPlayersByTeamAndSeason :many
SELECT sqlc.embed(player), team_membership.number FROM player
JOIN team_membership ON team_membership.player_id = player.id
WHERE team_membership.team_id = $1
  AND team_membership.season_id = $2
  AND team_membership.left_on IS NULL
ORDER BY player.lastname;

-- name: UpdatePlayer :one
UPDATE player
SET firstname = $1, lastname = $2, updated_at = now()
WHERE id = $3 
RETURNING *;
