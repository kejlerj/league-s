-- name: AddTeamToSeason :one
INSERT INTO season_team (season_id, team_id, league_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetTeamsBySeason :many
SELECT team.* FROM team
JOIN season_team ON season_team.team_id = team.id
WHERE season_team.season_id = $1
  AND season_team.league_id = $2
ORDER BY team.name;

-- name: RemoveTeamFromSeason :one
DELETE FROM season_team
WHERE season_id = $1 AND team_id = $2 AND league_id = $3
RETURNING *;
