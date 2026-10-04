-- +goose Up
CREATE TABLE squad_membership (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    player_id       UUID NOT NULL,
    season_id       UUID NOT NULL,
    team_id         UUID NOT NULL,
    league_id       UUID NOT NULL,
    number          INT CHECK (number BETWEEN 1 AND 99),
    joined_on       DATE NOT NULL,
    left_on         DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT squad_membership_player_fkey FOREIGN KEY (player_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT squad_membership_season_team_fkey FOREIGN KEY (season_id, team_id, league_id)
        REFERENCES season_team(season_id, team_id, league_id) ON DELETE CASCADE,
    CONSTRAINT squad_membership_left_after_joined CHECK (left_on IS NULL OR left_on >= joined_on)
);

CREATE UNIQUE INDEX squad_membership_active_number
    ON squad_membership (season_id, team_id, number)
    WHERE left_on IS NULL;

CREATE UNIQUE INDEX squad_membership_active_player
    ON squad_membership (player_id, season_id)
    WHERE left_on IS NULL;

CREATE INDEX squad_membership_player ON squad_membership (player_id);
CREATE INDEX squad_membership_team_season ON squad_membership (season_id, team_id);

-- +goose Down
DROP TABLE squad_membership;
