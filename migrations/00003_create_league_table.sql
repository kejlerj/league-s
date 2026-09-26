-- +goose Up
CREATE TABLE league (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    logo        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE league;
