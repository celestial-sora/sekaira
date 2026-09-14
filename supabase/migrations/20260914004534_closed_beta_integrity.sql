SET search_path TO sekaira;

CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS conversation_owner_updated ON conversations(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS world_character_character ON world_characters(character_id, world_id);

ALTER TABLE users ADD CONSTRAINT users_guest_value CHECK (guest IN (0, 1)) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_guest_value;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA sekaira FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA sekaira FROM PUBLIC, anon, authenticated;
