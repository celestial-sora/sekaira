SET search_path TO sekaira;

-- Runtime auth/profile contract. Migrations are authoritative; application startup
-- must not need ALTER TABLE privileges to make these fields exist.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS picture TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_range TEXT NOT NULL DEFAULT 'general';
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified INTEGER NOT NULL DEFAULT 1;

-- Publication is visibility/authorization state, so keep it in typed columns rather
-- than making every visibility query parse JSON.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve publication state written by older application versions.
UPDATE characters
SET published = COALESCE((data::jsonb ->> 'published')::boolean, FALSE)
WHERE published = FALSE AND data IS NOT NULL;

UPDATE worlds
SET published = COALESCE((data::jsonb ->> 'published')::boolean, FALSE)
WHERE published = FALSE AND data IS NOT NULL;

CREATE INDEX IF NOT EXISTS characters_public_visibility
  ON characters (published, id DESC);
CREATE INDEX IF NOT EXISTS worlds_public_visibility
  ON worlds (published, id DESC);
