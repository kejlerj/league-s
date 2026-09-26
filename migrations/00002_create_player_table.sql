-- +goose Up
CREATE TABLE player (
    id          BIGSERIAL PRIMARY KEY,
    firstname   TEXT NOT NULL,
    lastname    TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE player;
