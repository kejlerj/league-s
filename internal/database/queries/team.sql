
-- name: CreateTeam :one
INSERT INTO team (name, logo)
VALUES ($1, $2)
RETURNING *;

-- name: GetTeamByID :one
SELECT * FROM team WHERE id = $1;