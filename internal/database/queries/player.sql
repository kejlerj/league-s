-- name: CreatePlayer :one
INSERT INTO player (league_id, firstname, lastname, icon)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetPlayerByID :one
SELECT * FROM player WHERE id = $1 AND league_id = $2;

-- name: UpdatePlayer :one
UPDATE player
SET firstname = $1, lastname = $2, updated_at = now()
WHERE id = $3 AND league_id = $4
RETURNING *;
