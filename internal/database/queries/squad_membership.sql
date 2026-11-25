-- name: CreateSquadMembership :one
INSERT INTO squad_membership (player_id, season_id, team_id, league_id, number, joined_on)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: CloseSquadMembership :one
UPDATE squad_membership
SET left_on = sqlc.arg(left_on)::date, updated_at = now()
WHERE player_id = sqlc.arg(player_id)
  AND season_id = sqlc.arg(season_id)
  AND team_id = sqlc.arg(team_id)
  AND league_id = sqlc.arg(league_id)
  AND left_on IS NULL
RETURNING *;

-- name: GetSquadMembership :one
SELECT * FROM squad_membership
WHERE id = sqlc.arg(id)
  AND season_id = sqlc.arg(season_id)
  AND team_id = sqlc.arg(team_id)
  AND league_id = sqlc.arg(league_id);

-- name: UpdateSquadMembershipNumber :one
UPDATE squad_membership
SET number = sqlc.narg(number), updated_at = now()
WHERE id = sqlc.arg(id)
  AND season_id = sqlc.arg(season_id)
  AND team_id = sqlc.arg(team_id)
  AND league_id = sqlc.arg(league_id)
  AND left_on IS NULL
RETURNING *;

-- name: GetActiveSquadMembership :one
SELECT * FROM squad_membership
WHERE player_id = $1
  AND season_id = $2
  AND league_id = $3
  AND left_on IS NULL;

-- name: ListSquadMemberships :many
SELECT sqlc.embed(player), squad_membership.id AS membership_id, squad_membership.number, squad_membership.joined_on, squad_membership.left_on,
       (SELECT count(*) FROM match_event
        JOIN match ON match.id = match_event.match_id AND match.status = 'finished'
        WHERE match_event.league_id = squad_membership.league_id
          AND match_event.season_id = squad_membership.season_id
          AND match_event.team_id = squad_membership.team_id
          AND match_event.type = 'goal'
          AND NOT match_event.own_goal
          AND match_event.player_id = squad_membership.player_id)::int AS goals,
       (SELECT count(*) FROM match_event
        JOIN match ON match.id = match_event.match_id AND match.status = 'finished'
        WHERE match_event.league_id = squad_membership.league_id
          AND match_event.season_id = squad_membership.season_id
          AND match_event.team_id = squad_membership.team_id
          AND match_event.type = 'goal'
          AND match_event.assist_player_id = squad_membership.player_id)::int AS assists
FROM squad_membership
JOIN player ON player.id = squad_membership.player_id
  AND player.league_id = squad_membership.league_id
WHERE squad_membership.season_id = sqlc.arg(season_id)
  AND squad_membership.team_id = sqlc.arg(team_id)
  AND squad_membership.league_id = sqlc.arg(league_id)
  AND (sqlc.arg(include_history)::boolean OR squad_membership.left_on IS NULL)
ORDER BY player.lastname, player.firstname, squad_membership.joined_on;

-- name: GetSquadRules :one
SELECT season.start_on, season.end_on, season.max_squad_size
FROM season_team
JOIN season ON season.id = season_team.season_id
  AND season.league_id = season_team.league_id
WHERE season_team.season_id = sqlc.arg(season_id)
  AND season_team.team_id = sqlc.arg(team_id)
  AND season_team.league_id = sqlc.arg(league_id)
FOR SHARE OF season;

-- name: LockSquad :one
SELECT season.start_on, season.end_on, season.max_squad_size
FROM season_team
JOIN season ON season.id = season_team.season_id
  AND season.league_id = season_team.league_id
WHERE season_team.season_id = sqlc.arg(season_id)
  AND season_team.team_id = sqlc.arg(team_id)
  AND season_team.league_id = sqlc.arg(league_id)
FOR UPDATE OF season_team FOR SHARE OF season;

-- name: CountActiveSquadMembers :one
SELECT count(*) FROM squad_membership
WHERE season_id = sqlc.arg(season_id)
  AND team_id = sqlc.arg(team_id)
  AND league_id = sqlc.arg(league_id)
  AND left_on IS NULL;

-- name: ListPlayerCareer :many
SELECT squad_membership.id, squad_membership.number, squad_membership.joined_on, squad_membership.left_on,
       season.id AS season_id, season.name AS season_name,
       team.id AS team_id, team.name AS team_name, team.logo AS team_logo
FROM squad_membership
JOIN season ON season.id = squad_membership.season_id
  AND season.league_id = squad_membership.league_id
JOIN team ON team.id = squad_membership.team_id
  AND team.league_id = squad_membership.league_id
WHERE squad_membership.player_id = sqlc.arg(player_id)
  AND squad_membership.league_id = sqlc.arg(league_id)
ORDER BY squad_membership.joined_on DESC, squad_membership.id DESC;
