SET search_path TO sekaira;

ALTER TABLE characters ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private','public','friends','selected'));
UPDATE characters SET visibility='public' WHERE published=TRUE AND visibility='private';
CREATE INDEX IF NOT EXISTS character_visibility ON characters(visibility,owner_id);

CREATE TABLE IF NOT EXISTS friendships (
  user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_a,user_b),
  CHECK (user_a < user_b),
  CHECK (requested_by=user_a OR requested_by=user_b)
);
CREATE INDEX IF NOT EXISTS friendship_user_b ON friendships(user_b,status);

CREATE TABLE IF NOT EXISTS character_shares (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (character_id,user_id)
);
CREATE INDEX IF NOT EXISTS character_shares_user ON character_shares(user_id,character_id);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON friendships,character_shares FROM PUBLIC,anon,authenticated;
