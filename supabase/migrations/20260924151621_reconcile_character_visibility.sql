SET search_path TO sekaira;

-- Older characters could have the selected sharing option in JSON while the
-- separate visibility column still held its default, hiding them from others.
UPDATE characters
SET visibility = data::jsonb ->> 'visibility',
    published = CASE WHEN data::jsonb ->> 'visibility' = 'public' THEN TRUE ELSE published END
WHERE visibility = 'private'
  AND data IS NOT NULL
  AND data::jsonb ->> 'visibility' IN ('public', 'friends', 'selected');
