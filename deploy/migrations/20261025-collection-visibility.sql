-- Existing definitions remain public. Visibility does not change awards or draw odds.
BEGIN;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
COMMIT;
