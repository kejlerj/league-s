-- +goose Up
CREATE TABLE season_team (
    season_id   UUID NOT NULL,
    team_id     UUID NOT NULL,
    league_id   UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (season_id, team_id),
    CONSTRAINT season_team_season_fkey FOREIGN KEY (season_id, league_id)
        REFERENCES season(id, league_id) ON DELETE CASCADE,
    CONSTRAINT season_team_team_fkey FOREIGN KEY (team_id, league_id)
        REFERENCES team(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT season_team_league_key UNIQUE (season_id, team_id, league_id)
);

CREATE INDEX season_team_team ON season_team (team_id);

-- +goose Down
DROP TABLE season_team;
