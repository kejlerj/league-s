
-- name: CreateLeague :one
INSERT INTO league (name, logo)
VALUES ($1, $2)
RETURNING *;

-- name: GetLeagueByID :one
SELECT * FROM league WHERE id = $1;

-- name: GetLeagues :many
SELECT * FROM league ORDER BY name;

-- name: DeleteLeague :one
DELETE FROM league WHERE id = $1
RETURNING id;