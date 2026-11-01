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

-- name: ListLeagueAdmins :many
SELECT app_user.* FROM app_user
JOIN league_admin ON league_admin.user_id = app_user.id
WHERE league_admin.league_id = $1
ORDER BY app_user.name, app_user.email;

-- name: RemoveLeagueAdmin :execrows
DELETE FROM league_admin WHERE user_id = $1 AND league_id = $2;

-- name: DeletePendingInvitations :exec
DELETE FROM invitation
WHERE league_id = $1 AND email = $2 AND accepted_at IS NULL;

-- name: CreateInvitation :one
INSERT INTO invitation (league_id, email, token_hash, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListPendingInvitations :many
SELECT * FROM invitation
WHERE league_id = $1
  AND accepted_at IS NULL
  AND expires_at > sqlc.arg(now)::timestamptz
ORDER BY created_at;

-- name: DeletePendingInvitation :execrows
DELETE FROM invitation
WHERE id = $1 AND league_id = $2 AND accepted_at IS NULL;

-- name: GetPendingInvitation :one
SELECT invitation.email, league.id AS league_id, league.name AS league_name
FROM invitation
JOIN league ON league.id = invitation.league_id
WHERE invitation.token_hash = $1
  AND invitation.accepted_at IS NULL
  AND invitation.expires_at > sqlc.arg(now)::timestamptz;

-- name: AcceptInvitation :one
UPDATE invitation
SET accepted_at = sqlc.arg(now)::timestamptz
WHERE token_hash = $1
  AND accepted_at IS NULL
  AND expires_at > sqlc.arg(now)::timestamptz
RETURNING league_id, email;

-- name: DeleteExpiredSessions :execrows
DELETE FROM session WHERE expires_at <= sqlc.arg(now)::timestamptz;

-- name: DeleteDeadPasswordResets :execrows
DELETE FROM password_reset
WHERE expires_at <= sqlc.arg(now)::timestamptz OR used_at IS NOT NULL;

-- name: DeleteExpiredInvitations :execrows
DELETE FROM invitation
WHERE accepted_at IS NULL AND expires_at <= sqlc.arg(now)::timestamptz;
