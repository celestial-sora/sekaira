-- Model avatars are no longer used; character artwork lives in character data.
ALTER TABLE sekaira.characters DROP COLUMN IF EXISTS avatar_id;
DROP TABLE IF EXISTS sekaira.avatars;
