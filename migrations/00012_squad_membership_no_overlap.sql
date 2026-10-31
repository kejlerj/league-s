-- +goose Up
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE squad_membership ADD CONSTRAINT squad_membership_no_overlap
    EXCLUDE USING gist (player_id WITH =, season_id WITH =, daterange(joined_on, left_on, '[]') WITH &&);

-- +goose Down
ALTER TABLE squad_membership DROP CONSTRAINT squad_membership_no_overlap;
