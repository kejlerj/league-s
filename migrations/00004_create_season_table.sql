-- +goose Up
CREATE TABLE season (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    name            TEXT NOT NULL,
    start_on        DATE NOT NULL,
    end_on          DATE NOT NULL,
    match_win_pts   INT NOT NULL DEFAULT 3,
    match_draw_pts  INT NOT NULL DEFAULT 1,
    match_loss_pts  INT NOT NULL DEFAULT 0,
    tie_breakers    TEXT[] NOT NULL DEFAULT '{goal_difference,goals_scored}',
    max_squad_size  INT CHECK (max_squad_size > 0),
    league_id       UUID NOT NULL REFERENCES league(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT season_league_name_key UNIQUE (league_id, name),
    CONSTRAINT season_id_league_key UNIQUE (id, league_id),
    CHECK (end_on > start_on)
);

-- +goose Down
DROP TABLE season;
