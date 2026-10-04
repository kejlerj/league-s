-- +goose Up
CREATE TABLE league (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    name        TEXT NOT NULL,
    logo        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE league;
