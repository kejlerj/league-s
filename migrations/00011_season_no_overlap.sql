-- +goose Up
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE season ADD CONSTRAINT season_league_no_overlap
    EXCLUDE USING gist (league_id WITH =, daterange(start_on, end_on, '[]') WITH &&);

-- +goose Down
ALTER TABLE season DROP CONSTRAINT season_league_no_overlap;

DROP EXTENSION IF EXISTS btree_gist;
