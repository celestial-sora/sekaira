import { db, hasPostgres } from "./database";
import type { Character, World } from "./types";

type CommunityTable = "characters" | "worlds";
type CommunityEntity = Character | World;
export type VisibleAvatar = { id: string; owner_id: string; type: string; asset_url: string };

let visibilitySchemaReady: Promise<void> | undefined;

async function ensureVisibilitySchema() {
  if (!hasPostgres()) return;
  visibilitySchemaReady ??= (async () => {
    for (const table of ["characters", "worlds"] as const) {
      await db().prepare(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE`).run();
      await db().prepare(
        `UPDATE ${table} SET published = COALESCE((data::jsonb ->> 'published')::boolean, FALSE) WHERE published = FALSE AND data IS NOT NULL`,
      ).run();
    }
  })().catch((error) => {
    visibilitySchemaReady = undefined;
    throw error;
  });
  await visibilitySchemaReady;
}

export async function listCommunity<T extends CommunityEntity>(table: CommunityTable, userId: string | null): Promise<T[]> {
  await ensureVisibilitySchema();
  const rows = await db().prepare(
    `SELECT ${table}.data, ${table}.published, ${table}.owner_id, users.name AS creator_name, users.picture AS creator_picture FROM ${table} LEFT JOIN users ON users.id = ${table}.owner_id WHERE ${table}.owner_id IS NULL OR ${table}.owner_id = ? OR ${table}.published ORDER BY ${table}.id DESC`,
  ).all(userId);
  return rows.map((row) => ({
    ...JSON.parse(row.data as string),
    published: Boolean(row.published),
    creator_name: row.creator_name ?? null,
    creator_picture: row.creator_picture ?? null,
  })) as T[];
}

export async function getCommunity<T extends CommunityEntity>(table: CommunityTable, entityId: string, userId: string | null): Promise<T | null> {
  await ensureVisibilitySchema();
  const row = await db().prepare(
    `SELECT data, published FROM ${table} WHERE id = ? AND (owner_id IS NULL OR owner_id = ? OR published)`,
  ).get(entityId, userId);
  return row ? ({ ...JSON.parse(row.data as string), published: Boolean(row.published) } as T) : null;
}

export async function getVisibleAvatar(avatarId: string, userId: string | null): Promise<VisibleAvatar | null> {
  await ensureVisibilitySchema();
  const row = await db().prepare(
    `SELECT a.id,a.owner_id,a.type,a.asset_url FROM avatars a WHERE a.id=? AND (a.owner_id=? OR EXISTS (SELECT 1 FROM characters c WHERE c.avatar_id=a.id AND (c.owner_id IS NULL OR c.owner_id=? OR c.published)))`,
  ).get(avatarId, userId, userId);
  return row ? row as VisibleAvatar : null;
}

export async function setPublished(table: CommunityTable, entityId: string, ownerId: string, published: boolean): Promise<boolean> {
  await ensureVisibilitySchema();
  const row = await db().prepare(`SELECT data FROM ${table} WHERE id=? AND owner_id=?`).get(entityId, ownerId);
  if (!row) return false;
  const data = { ...JSON.parse(row.data as string), published };
  const storedPublished = hasPostgres() ? published : published ? 1 : 0;
  const result = await db().prepare(`UPDATE ${table} SET published=?, data=? WHERE id=? AND owner_id=?`).run(storedPublished, JSON.stringify(data), entityId, ownerId);
  return result.changes === 1;
}
