-- name: CreatePlayer :one
INSERT INTO player (league_id, firstname, lastname, icon)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetPlayerByID :one
SELECT * FROM player WHERE id = $1 AND league_id = $2;

-- name: UpdatePlayer :one
UPDATE player
SET firstname = COALESCE(sqlc.narg(firstname), firstname),
    lastname = COALESCE(sqlc.narg(lastname), lastname),
    icon = COALESCE(sqlc.narg(icon), icon),
    updated_at = now()
WHERE id = $1 AND league_id = $2
RETURNING *;

-- name: DeletePlayer :execrows
DELETE FROM player WHERE id = $1 AND league_id = $2;

-- name: ListPlayers :many
SELECT * FROM player
WHERE league_id = $1
  AND (sqlc.arg(search)::text = ''
       OR strpos(lower(firstname || ' ' || lastname), lower(sqlc.arg(search)::text)) > 0
       OR strpos(lower(lastname || ' ' || firstname), lower(sqlc.arg(search)::text)) > 0)
ORDER BY lastname, firstname, id;
