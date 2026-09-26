-- +goose Up
CREATE TABLE team_membership (
    id              BIGSERIAL PRIMARY KEY,
    player_id       BIGINT NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
    season_id       BIGINT NOT NULL,
    team_id         BIGINT NOT NULL,
    number          INT CHECK (number BETWEEN 1 AND 99),
    joined_on       DATE NOT NULL,
    left_on         DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY     (season_id, team_id) REFERENCES season_team(season_id, team_id) ON DELETE CASCADE,
    CHECK (left_on IS NULL OR left_on >= joined_on)
);

CREATE UNIQUE INDEX team_membership_active_number
    ON team_membership (season_id, team_id, number)
    WHERE left_on IS NULL;

CREATE UNIQUE INDEX team_membership_active_player
    ON team_membership (player_id, season_id)
    WHERE left_on IS NULL;

-- The partial indexes above only cover active members
CREATE INDEX team_membership_player ON team_membership (player_id);
CREATE INDEX team_membership_squad  ON team_membership (season_id, team_id);

-- +goose Down
DROP TABLE team_membership;
