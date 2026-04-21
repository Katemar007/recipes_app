-- Recipe denormalized category: never NULL (empty string when uncategorized).
-- Ingredient and shopping line categories stay nullable.

UPDATE recipes SET category = '' WHERE category IS NULL;

ALTER TABLE recipes ALTER COLUMN category SET DEFAULT '';
ALTER TABLE recipes ALTER COLUMN category SET NOT NULL;
