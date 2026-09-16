import { db } from "./database";
import type { Character, World } from "./types";

type CommunityTable = "characters" | "worlds";
type CommunityEntity = Character | World;

export async function listCommunity<T extends CommunityEntity>(table: CommunityTable, userId: string | null): Promise<T[]> {
  const rows = await db().prepare(
    `SELECT ${table}.data, ${table}.published, ${table}.owner_id, users.name AS creator_name, users.picture AS creator_picture FROM ${table} LEFT JOIN users ON users.id = ${table}.owner_id WHERE ${table}.owner_id IS NULL OR ${table}.owner_id = ? OR ${table}.published = 1 ORDER BY ${table}.id DESC`,
  ).all(userId);
  return rows.map((row) => ({
    ...JSON.parse(row.data as string),
    published: Boolean(row.published),
    creator_name: row.creator_name ?? null,
    creator_picture: row.creator_picture ?? null,
  })) as T[];
}

export async function getCommunity<T extends CommunityEntity>(table: CommunityTable, entityId: string, userId: string | null): Promise<T | null> {
  const row = await db().prepare(
    `SELECT data, published FROM ${table} WHERE id = ? AND (owner_id IS NULL OR owner_id = ? OR published = 1)`,
  ).get(entityId, userId);
  return row ? ({ ...JSON.parse(row.data as string), published: Boolean(row.published) } as T) : null;
}

export async function setPublished(table: CommunityTable, entityId: string, ownerId: string, published: boolean): Promise<boolean> {
  const row = await db().prepare(`SELECT data FROM ${table} WHERE id=? AND owner_id=?`).get(entityId, ownerId);
  if (!row) return false;
  const data = { ...JSON.parse(row.data as string), published };
  const result = await db().prepare(`UPDATE ${table} SET published=?, data=? WHERE id=? AND owner_id=?`).run(published ? 1 : 0, JSON.stringify(data), entityId, ownerId);
  return result.changes === 1;
}
