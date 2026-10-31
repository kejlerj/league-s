-- +goose Up
CREATE TABLE invitation (
    id           UUID PRIMARY KEY DEFAULT uuidv7(),
    league_id    UUID NOT NULL REFERENCES league(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    token_hash   BYTEA NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    accepted_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invitation_token_hash_key UNIQUE (token_hash),
    CONSTRAINT invitation_email_lowercase CHECK (email = lower(email))
);

CREATE INDEX invitation_league ON invitation (league_id);

-- +goose Down
DROP TABLE invitation;
