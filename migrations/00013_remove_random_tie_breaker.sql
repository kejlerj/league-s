-- +goose Up
ALTER TABLE season ALTER COLUMN tie_breakers SET DEFAULT '{goal_difference,head_to_head}';

UPDATE season
SET tie_breakers = CASE
    WHEN array_remove(tie_breakers, 'random') = '{}' THEN '{goal_difference,head_to_head}'
    ELSE array_remove(tie_breakers, 'random')
END
WHERE 'random' = ANY (tie_breakers);

-- +goose Down
ALTER TABLE season ALTER COLUMN tie_breakers SET DEFAULT '{goal_difference,goals_scored}';
