-- name: LockSeason :one
SELECT start_on, end_on FROM season
WHERE id = sqlc.arg(id) AND league_id = sqlc.arg(league_id)
FOR UPDATE;

-- name: CreateMatch :one
INSERT INTO match (season_id, home_team_id, away_team_id, matchday, kickoff_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetMatch :one
SELECT match.* FROM match
JOIN season ON season.id = match.season_id
WHERE match.id = sqlc.arg(id)
  AND match.season_id = sqlc.arg(season_id)
  AND season.league_id = sqlc.arg(league_id);

-- name: GetMatchForUpdate :one
SELECT match.* FROM match
JOIN season ON season.id = match.season_id
WHERE match.id = sqlc.arg(id)
  AND match.season_id = sqlc.arg(season_id)
  AND season.league_id = sqlc.arg(league_id)
FOR UPDATE OF match;

-- name: UpdateMatch :one
UPDATE match
SET matchday = sqlc.arg(matchday),
    kickoff_at = sqlc.narg(kickoff_at),
    status = sqlc.arg(status),
    home_score = sqlc.narg(home_score),
    away_score = sqlc.narg(away_score),
    updated_at = now()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteMatch :exec
DELETE FROM match WHERE id = $1;

-- name: ListMatches :many
SELECT match.* FROM match
JOIN season ON season.id = match.season_id
WHERE match.season_id = sqlc.arg(season_id)
  AND season.league_id = sqlc.arg(league_id)
  AND (sqlc.narg(matchday)::int IS NULL OR match.matchday = sqlc.narg(matchday)::int)
  AND (sqlc.narg(from_at)::timestamptz IS NULL OR match.kickoff_at >= sqlc.narg(from_at)::timestamptz)
  AND (sqlc.narg(to_at)::timestamptz IS NULL OR match.kickoff_at < sqlc.narg(to_at)::timestamptz)
  AND (sqlc.narg(team_id)::uuid IS NULL OR sqlc.narg(team_id)::uuid IN (match.home_team_id, match.away_team_id))
  AND (sqlc.narg(status)::match_status IS NULL OR match.status = sqlc.narg(status)::match_status)
ORDER BY match.matchday, match.kickoff_at NULLS LAST, match.id;

-- name: CountTeamMatchesOnMatchday :one
SELECT count(*) FROM match
WHERE season_id = sqlc.arg(season_id)
  AND matchday = sqlc.arg(matchday)
  AND status <> 'cancelled'
  AND id <> sqlc.arg(exclude_id)
  AND (home_team_id = ANY(sqlc.arg(team_ids)::uuid[]) OR away_team_id = ANY(sqlc.arg(team_ids)::uuid[]));
