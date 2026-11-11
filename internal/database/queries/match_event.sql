-- name: CreateMatchEvent :one
INSERT INTO match_event (league_id, season_id, match_id, team_id, type, minute, player_id, assist_player_id, player_in_id, own_goal, penalty, note)
VALUES (
    sqlc.arg(league_id), sqlc.arg(season_id), sqlc.arg(match_id), sqlc.arg(team_id), sqlc.arg(type), sqlc.arg(minute),
    sqlc.narg(player_id), sqlc.narg(assist_player_id), sqlc.narg(player_in_id), sqlc.arg(own_goal), sqlc.arg(penalty), sqlc.narg(note)
)
RETURNING *;

-- name: ListMatchEvents :many
SELECT match_event.*,
       scorer.firstname AS player_firstname, scorer.lastname AS player_lastname,
       assist.firstname AS assist_firstname, assist.lastname AS assist_lastname,
       player_in.firstname AS player_in_firstname, player_in.lastname AS player_in_lastname
FROM match_event
LEFT JOIN player scorer ON scorer.id = match_event.player_id
LEFT JOIN player assist ON assist.id = match_event.assist_player_id
LEFT JOIN player player_in ON player_in.id = match_event.player_in_id
WHERE match_event.league_id = sqlc.arg(league_id)
  AND match_event.season_id = sqlc.arg(season_id)
  AND match_event.match_id = sqlc.arg(match_id)
ORDER BY match_event.minute, match_event.id;

-- name: DeleteMatchEvent :execrows
DELETE FROM match_event
WHERE id = sqlc.arg(id)
  AND match_id = sqlc.arg(match_id)
  AND season_id = sqlc.arg(season_id)
  AND league_id = sqlc.arg(league_id);

-- name: IsSquadMemberOn :one
SELECT EXISTS (
    SELECT 1 FROM squad_membership
    WHERE league_id = sqlc.arg(league_id)
      AND season_id = sqlc.arg(season_id)
      AND team_id = sqlc.arg(team_id)
      AND player_id = sqlc.arg(player_id)
      AND joined_on <= sqlc.arg(day)::date
      AND (left_on IS NULL OR left_on >= sqlc.arg(day)::date)
);

-- name: ListFinishedSeasonEvents :many
SELECT match_event.*,
       scorer.firstname AS player_firstname, scorer.lastname AS player_lastname,
       assist.firstname AS assist_firstname, assist.lastname AS assist_lastname
FROM match_event
JOIN match ON match.id = match_event.match_id AND match.season_id = match_event.season_id
LEFT JOIN player scorer ON scorer.id = match_event.player_id
LEFT JOIN player assist ON assist.id = match_event.assist_player_id
WHERE match_event.league_id = sqlc.arg(league_id)
  AND match_event.season_id = sqlc.arg(season_id)
  AND match.status = 'finished'
  AND match_event.type::text = ANY(sqlc.arg(types)::text[])
ORDER BY match.kickoff_at NULLS FIRST, match.id, match_event.minute, match_event.id;
