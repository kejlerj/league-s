-- name: CreateTeam :one
INSERT INTO team (league_id, name, logo)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetTeamByID :one
SELECT * FROM team WHERE id = $1 AND league_id = $2;

-- name: GetTeamsByLeagueID :many
SELECT * FROM team WHERE league_id = $1 ORDER BY name;