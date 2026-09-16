-- Runtime-required user fields must be migration-owned, not created by app startup.
ALTER TABLE sekaira.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE sekaira.users ADD COLUMN IF NOT EXISTS picture TEXT;
ALTER TABLE sekaira.users ADD COLUMN IF NOT EXISTS admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sekaira.users ADD COLUMN IF NOT EXISTS age_range TEXT NOT NULL DEFAULT 'general';
ALTER TABLE sekaira.users ADD COLUMN IF NOT EXISTS age_verified INTEGER NOT NULL DEFAULT 1;

-- Publication is authorization state, so keep it in first-class columns.
ALTER TABLE sekaira.characters ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sekaira.worlds ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE sekaira.characters
SET published = COALESCE((data::jsonb ->> 'published')::boolean, FALSE);
UPDATE sekaira.worlds
SET published = COALESCE((data::jsonb ->> 'published')::boolean, FALSE);

CREATE INDEX IF NOT EXISTS characters_publication ON sekaira.characters (published, id DESC);
CREATE INDEX IF NOT EXISTS worlds_publication ON sekaira.worlds (published, id DESC);
