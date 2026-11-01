-- +goose Up
ALTER TABLE match ADD CONSTRAINT match_id_season_key UNIQUE (id, season_id);

CREATE TYPE match_event_type AS ENUM ('goal', 'yellow_card', 'red_card', 'substitution', 'injury');

CREATE TABLE match_event (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    league_id         UUID NOT NULL,
    season_id         UUID NOT NULL,
    match_id          UUID NOT NULL,
    team_id           UUID NOT NULL,
    type              match_event_type NOT NULL,
    minute            INT NOT NULL CHECK (minute BETWEEN 1 AND 150),
    player_id         UUID,
    assist_player_id  UUID,
    player_in_id      UUID,
    own_goal          BOOLEAN NOT NULL DEFAULT false,
    penalty           BOOLEAN NOT NULL DEFAULT false,
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT match_event_match_fkey FOREIGN KEY (match_id, season_id)
        REFERENCES match(id, season_id) ON DELETE CASCADE,
    CONSTRAINT match_event_team_fkey FOREIGN KEY (season_id, team_id, league_id)
        REFERENCES season_team(season_id, team_id, league_id),
    CONSTRAINT match_event_player_fkey FOREIGN KEY (player_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT match_event_assist_fkey FOREIGN KEY (assist_player_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT match_event_player_in_fkey FOREIGN KEY (player_in_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT match_event_goal_fields CHECK (type = 'goal' OR (NOT own_goal AND NOT penalty AND assist_player_id IS NULL)),
    CONSTRAINT match_event_player_required CHECK (type NOT IN ('yellow_card', 'red_card', 'injury') OR player_id IS NOT NULL),
    CONSTRAINT match_event_note CHECK (note IS NULL OR (type = 'injury' AND char_length(note) BETWEEN 1 AND 200)),
    CONSTRAINT match_event_substitution_players CHECK (
        (type = 'substitution') = (player_in_id IS NOT NULL)
        AND (type <> 'substitution' OR (player_id IS NOT NULL AND player_id <> player_in_id))
    ),
    CONSTRAINT match_event_no_assist CHECK (NOT (penalty OR own_goal) OR assist_player_id IS NULL)
);

CREATE INDEX match_event_match ON match_event (match_id, minute, id);
CREATE INDEX match_event_season ON match_event (season_id, type);

-- +goose Down
DROP TABLE match_event;
DROP TYPE match_event_type;
ALTER TABLE match DROP CONSTRAINT match_id_season_key;
