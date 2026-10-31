-- name: CreateSeason :one
INSERT INTO season (
    name, start_on, end_on, match_win_pts, match_draw_pts, match_loss_pts, tie_breakers, max_squad_size, league_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetSeasonByID :one
SELECT * FROM season WHERE id = $1 AND league_id = $2;

-- name: GetSeasonsByLeague :many
SELECT * FROM season WHERE league_id = $1 ORDER BY start_on DESC;

-- name: UpdateSeason :one
UPDATE season
SET name = COALESCE(sqlc.narg(name), name),
    start_on = COALESCE(sqlc.narg(start_on), start_on),
    end_on = COALESCE(sqlc.narg(end_on), end_on),
    match_win_pts = COALESCE(sqlc.narg(match_win_pts), match_win_pts),
    match_draw_pts = COALESCE(sqlc.narg(match_draw_pts), match_draw_pts),
    match_loss_pts = COALESCE(sqlc.narg(match_loss_pts), match_loss_pts),
    tie_breakers = COALESCE(sqlc.narg(tie_breakers), tie_breakers),
    updated_at = now()
WHERE id = $1 AND league_id = $2
RETURNING *;

-- name: DeleteSeason :execrows
DELETE FROM season WHERE id = $1 AND league_id = $2;
