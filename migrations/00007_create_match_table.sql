-- +goose Up
CREATE TYPE match_status AS ENUM ('scheduled', 'live', 'finished', 'postponed', 'cancelled');

CREATE TABLE match (
    id            UUID PRIMARY KEY DEFAULT uuidv7(),
    season_id     UUID NOT NULL,
    home_team_id  UUID NOT NULL,
    away_team_id  UUID NOT NULL,
    matchday      INT NOT NULL CHECK (matchday > 0),
    kickoff_at    TIMESTAMPTZ,
    status        match_status NOT NULL DEFAULT 'scheduled',
    home_score    INT CHECK (home_score >= 0),
    away_score    INT CHECK (away_score >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT match_home_team_fkey FOREIGN KEY (season_id, home_team_id)
        REFERENCES season_team(season_id, team_id) ON DELETE RESTRICT,
    CONSTRAINT match_away_team_fkey FOREIGN KEY (season_id, away_team_id)
        REFERENCES season_team(season_id, team_id) ON DELETE RESTRICT,
    CHECK (home_team_id <> away_team_id),
    CHECK ((home_score IS NULL) = (away_score IS NULL)),
    CHECK (status <> 'finished' OR home_score IS NOT NULL)
);

CREATE INDEX match_season_matchday ON match (season_id, matchday);
CREATE INDEX match_season_kickoff  ON match (season_id, kickoff_at);
CREATE INDEX match_home_team       ON match (home_team_id);
CREATE INDEX match_away_team       ON match (away_team_id);

-- +goose Down
DROP TABLE match;
DROP TYPE match_status;
