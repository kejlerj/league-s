-- name: CreateTeam :one
INSERT INTO team (league_id, name, logo)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetTeamByID :one
SELECT * FROM team WHERE id = $1 AND league_id = $2;

-- name: GetTeamsByLeagueID :many
SELECT * FROM team WHERE league_id = $1 ORDER BY name;

-- name: UpdateTeam :one
UPDATE team
SET name = COALESCE(sqlc.narg(name), name),
    logo = COALESCE(sqlc.narg(logo), logo),
    updated_at = now()
WHERE id = $1 AND league_id = $2
RETURNING *;

-- name: DeleteTeam :execrows
DELETE FROM team WHERE id = $1 AND league_id = $2;

-- name: TeamExists :one
SELECT EXISTS (SELECT 1 FROM team WHERE id = $1 AND league_id = $2);
