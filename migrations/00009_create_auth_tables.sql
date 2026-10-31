-- +goose Up
CREATE TABLE app_user (
    id             UUID PRIMARY KEY DEFAULT uuidv7(),
    email          TEXT NOT NULL,
    name           TEXT NOT NULL,
    password_hash  TEXT,
    is_superadmin  BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT app_user_email_key UNIQUE (email),
    CONSTRAINT app_user_email_lowercase CHECK (email = lower(email))
);

CREATE TABLE league_admin (
    user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    league_id   UUID NOT NULL REFERENCES league(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, league_id)
);

CREATE INDEX league_admin_league ON league_admin (league_id);

CREATE TABLE session (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash  BYTEA NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT session_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX session_owner ON session (user_id);

CREATE TABLE password_reset (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash  BYTEA NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT password_reset_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX password_reset_owner ON password_reset (user_id);

-- +goose Down
DROP TABLE password_reset;
DROP TABLE session;
DROP TABLE league_admin;
DROP TABLE app_user;
