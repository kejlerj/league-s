-- name: CreatePlayer :one
INSERT INTO player (league_id, firstname, lastname, icon)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetPlayerByID :one
SELECT sqlc.embed(player),
       team.id AS current_team_id,
       team.name AS current_team_name,
       team.logo AS current_team_logo
FROM player
LEFT JOIN team ON team.league_id = player.league_id
  AND team.id = (
    SELECT squad_membership.team_id
    FROM squad_membership
    JOIN season ON season.id = squad_membership.season_id
      AND season.league_id = squad_membership.league_id
    WHERE squad_membership.player_id = player.id
      AND squad_membership.league_id = player.league_id
      AND squad_membership.left_on IS NULL
    ORDER BY season.start_on DESC
    LIMIT 1
  )
WHERE player.id = $1 AND player.league_id = $2;

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

-- name: PlayerExists :one
SELECT EXISTS (SELECT 1 FROM player WHERE id = $1 AND league_id = $2);
