-- +goose Up
CREATE TABLE player (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    league_id   UUID NOT NULL REFERENCES league(id) ON DELETE RESTRICT,
    firstname   TEXT NOT NULL,
    lastname    TEXT NOT NULL,
    icon        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT player_id_league_key UNIQUE (id, league_id)
);

-- +goose Down
DROP TABLE player;
