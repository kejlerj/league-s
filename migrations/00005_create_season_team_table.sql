-- +goose Up
CREATE TABLE season_team (
    season_id   BIGINT NOT NULL REFERENCES season(id) ON DELETE CASCADE,
    team_id     BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (season_id, team_id)
);

-- The primary key starts with season_id, so it doesn't help to find a team's seasons
CREATE INDEX season_team_team ON season_team (team_id);

-- +goose Down
DROP TABLE season_team;
