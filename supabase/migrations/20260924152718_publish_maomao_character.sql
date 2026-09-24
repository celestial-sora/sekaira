SET search_path TO sekaira;

-- The owner explicitly requested that this character be visible to everyone.
-- Match by names and require a single target instead of persisting a user ID.
DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM characters c JOIN users u ON u.id = c.owner_id
    WHERE lower(u.name) = 'sora'
      AND lower(c.data::jsonb ->> 'name') = 'maomao'
      AND c.visibility = 'private'
  ) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one private Maomao character owned by Sora';
  END IF;
END $$;

UPDATE characters c
SET visibility = 'public',
    published = TRUE,
    data = jsonb_set(
      jsonb_set(c.data::jsonb, '{visibility}', '"public"'::jsonb, TRUE),
      '{published}', 'true'::jsonb, TRUE
    )::text
FROM users u
WHERE u.id = c.owner_id
  AND lower(u.name) = 'sora'
  AND lower(c.data::jsonb ->> 'name') = 'maomao'
  AND c.visibility = 'private';
