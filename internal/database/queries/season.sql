-- name: CreateSeason :one
INSERT INTO season (
    name, start_on, end_on, match_win_pts, match_draw_pts, match_loss_pts, tie_breakers, league_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: GetSeasonByID :one
SELECT * FROM season WHERE id = $1 AND league_id = $2;

-- name: GetSeasonsByLeague :many
SELECT * FROM season WHERE league_id = $1 ORDER BY start_on DESC;
