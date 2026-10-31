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
       OR firstname || ' ' || lastname ILIKE '%' || sqlc.arg(search)::text || '%'
       OR lastname || ' ' || firstname ILIKE '%' || sqlc.arg(search)::text || '%')
ORDER BY lastname, firstname, id;
