// Every character read uses this predicate so links, lists, chats, and avatar
// downloads share the same visibility decision. The alias is a fixed code value.
export function visibleCharacterWhere(alias: 'c' | 'characters') {
  return `(${alias}.owner_id IS NULL OR ${alias}.owner_id=? OR ${alias}.visibility='public' OR (
    ${alias}.visibility IN ('friends','selected')
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status='accepted'
        AND ((f.user_a=${alias}.owner_id AND f.user_b=?) OR (f.user_b=${alias}.owner_id AND f.user_a=?))
    )
    AND (${alias}.visibility='friends' OR EXISTS (
      SELECT 1 FROM character_shares cs WHERE cs.character_id=${alias}.id AND cs.user_id=?
    ))
  ))`;
}

export function characterViewerArgs(viewer: string | null): [string | null, string | null, string | null, string | null] {
  return [viewer, viewer, viewer, viewer];
}
