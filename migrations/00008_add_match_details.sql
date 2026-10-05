-- +goose Up
ALTER TABLE match
    ADD COLUMN venue          TEXT,
    ADD COLUMN referee        TEXT,
    ADD COLUMN convocation_at TIMESTAMPTZ,
    ADD COLUMN video_url      TEXT;

-- +goose Down
ALTER TABLE match
    DROP COLUMN venue,
    DROP COLUMN referee,
    DROP COLUMN convocation_at,
    DROP COLUMN video_url;
