-- +goose Up
CREATE TABLE season (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    start_on        DATE NOT NULL,
    end_on          DATE NOT NULL,
    match_win_pts   INT NOT NULL DEFAULT 3,
    match_draw_pts  INT NOT NULL DEFAULT 1,
    match_loss_pts  INT NOT NULL DEFAULT 0,
    tie_breakers    TEXT[] NOT NULL DEFAULT '{goal_difference,goals_for}',
    league_id       BIGINT NOT NULL REFERENCES league(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (league_id, name),
    CHECK (end_on > start_on)
);

-- +goose Down
DROP TABLE season;
