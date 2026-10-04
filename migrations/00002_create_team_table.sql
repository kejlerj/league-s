-- +goose Up
CREATE TABLE team (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    league_id   UUID NOT NULL REFERENCES league(id) ON DELETE RESTRICT,
    name        TEXT NOT NULL,
    logo        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT team_league_name_key UNIQUE (league_id, name),
    CONSTRAINT team_id_league_key UNIQUE (id, league_id)
);

-- +goose Down
DROP TABLE team;
