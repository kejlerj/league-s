-- name: CreateUser :one
INSERT INTO app_user (email, name, password_hash, is_superadmin)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM app_user WHERE email = $1;

-- name: CreateSession :exec
INSERT INTO session (user_id, token_hash, expires_at)
VALUES ($1, $2, $3);

-- name: GetSessionUser :one
SELECT sqlc.embed(app_user), session.expires_at
FROM session
JOIN app_user ON app_user.id = session.user_id
WHERE session.token_hash = $1
  AND session.expires_at > sqlc.arg(now)::timestamptz;

-- name: ExtendSession :exec
UPDATE session SET expires_at = $2 WHERE token_hash = $1;

-- name: DeleteSession :exec
DELETE FROM session WHERE token_hash = $1;

-- name: AddLeagueAdmin :exec
INSERT INTO league_admin (user_id, league_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: IsLeagueAdmin :one
SELECT EXISTS (
    SELECT 1 FROM league_admin WHERE user_id = $1 AND league_id = $2
);

-- name: ListAdminLeagues :many
SELECT league.id, league.name FROM league
JOIN league_admin ON league_admin.league_id = league.id
WHERE league_admin.user_id = $1
ORDER BY league.name;

-- name: DeleteOtherSessions :exec
DELETE FROM session WHERE user_id = $1 AND token_hash <> $2;

-- name: DeleteUserSessions :exec
DELETE FROM session WHERE user_id = $1;

-- name: SetPassword :exec
UPDATE app_user SET password_hash = $2, updated_at = now() WHERE id = $1;

-- name: DeletePasswordResets :exec
DELETE FROM password_reset WHERE user_id = $1;

-- name: CreatePasswordReset :exec
INSERT INTO password_reset (user_id, token_hash, expires_at)
VALUES ($1, $2, $3);

-- name: ResetPassword :one
WITH consumed AS (
    UPDATE password_reset
    SET used_at = sqlc.arg(now)::timestamptz
    WHERE token_hash = sqlc.arg(token_hash)
      AND used_at IS NULL
      AND expires_at > sqlc.arg(now)::timestamptz
    RETURNING user_id
)
UPDATE app_user
SET password_hash = sqlc.arg(password_hash), updated_at = now()
FROM consumed
WHERE app_user.id = consumed.user_id
RETURNING app_user.id;
