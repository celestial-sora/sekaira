import { db, hasPostgres, transaction } from "./database";
import { characterViewerArgs, visibleCharacterWhere } from "./character-access";
import type { Character, CharacterVisibility, World } from "./types";

type CommunityTable = "characters" | "worlds";
type CommunityEntity = Character | World;
export type VisibleAvatar = { id: string; owner_id: string; type: string; asset_url: string };

let visibilitySchemaReady: Promise<void> | undefined;

export async function ensureVisibilitySchema() {
  if (!hasPostgres()) return;
  visibilitySchemaReady ??= (async () => {
    for (const table of ["characters", "worlds"] as const) {
      await db().prepare(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE`).run();
      await db().prepare(
        `UPDATE ${table} SET published = COALESCE((data::jsonb ->> 'published')::boolean, FALSE) WHERE published = FALSE AND data IS NOT NULL`,
      ).run();
    }
    await db().prepare("ALTER TABLE characters ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'").run();
    await db().prepare("UPDATE characters SET visibility='public' WHERE published=TRUE AND visibility='private'").run();
    await db().prepare("CREATE INDEX IF NOT EXISTS character_visibility ON sekaira.characters(visibility,owner_id)").run();
    await db().prepare("CREATE TABLE IF NOT EXISTS sekaira.friendships (user_a TEXT NOT NULL REFERENCES sekaira.users(id) ON DELETE CASCADE,user_b TEXT NOT NULL REFERENCES sekaira.users(id) ON DELETE CASCADE,requested_by TEXT NOT NULL REFERENCES sekaira.users(id) ON DELETE CASCADE,status TEXT NOT NULL CHECK(status IN ('pending','accepted')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_a,user_b),CHECK(user_a<user_b),CHECK(requested_by=user_a OR requested_by=user_b))").run();
    await db().prepare("CREATE INDEX IF NOT EXISTS friendship_user_b ON sekaira.friendships(user_b,status)").run();
    await db().prepare("CREATE TABLE IF NOT EXISTS sekaira.character_shares (character_id TEXT NOT NULL REFERENCES sekaira.characters(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES sekaira.users(id) ON DELETE CASCADE,PRIMARY KEY(character_id,user_id))").run();
    await db().prepare("CREATE INDEX IF NOT EXISTS character_shares_user ON sekaira.character_shares(user_id,character_id)").run();
    await db().prepare('ALTER TABLE sekaira.friendships ENABLE ROW LEVEL SECURITY').run();
    await db().prepare('ALTER TABLE sekaira.character_shares ENABLE ROW LEVEL SECURITY').run();
    await db().prepare('REVOKE ALL ON sekaira.friendships,sekaira.character_shares FROM PUBLIC,anon,authenticated').run();
  })().catch((error) => {
    visibilitySchemaReady = undefined;
    throw error;
  });
  await visibilitySchemaReady;
}

export async function listCommunity<T extends CommunityEntity>(table: CommunityTable, userId: string | null): Promise<T[]> {
  await ensureVisibilitySchema();
  if (table === "characters") {
    const rows = await db().prepare(
      `SELECT characters.data,characters.published,characters.visibility,characters.owner_id,users.name AS creator_name,users.picture AS creator_picture FROM characters LEFT JOIN users ON users.id=characters.owner_id WHERE ${visibleCharacterWhere('characters')} ORDER BY characters.id DESC`,
    ).all(...characterViewerArgs(userId));
    return rows.map((row) => ({
      ...JSON.parse(row.data as string),
      published: Boolean(row.published),
      visibility: row.owner_id === null ? 'public' : row.visibility,
      creator_name: row.creator_name ?? null,
      creator_picture: row.creator_picture ?? null,
    })) as T[];
  }
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
  if (table === 'characters') {
    const row = await db().prepare(
      `SELECT c.data,c.published,c.visibility,c.owner_id FROM characters c WHERE c.id=? AND ${visibleCharacterWhere('c')}`,
    ).get(entityId,...characterViewerArgs(userId));
    return row ? ({...JSON.parse(row.data as string),published:Boolean(row.published),visibility:row.owner_id===null?'public':row.visibility} as T) : null;
  }
  const row = await db().prepare(
    `SELECT data, published FROM ${table} WHERE id = ? AND (owner_id IS NULL OR owner_id = ? OR published)`,
  ).get(entityId, userId);
  return row ? ({ ...JSON.parse(row.data as string), published: Boolean(row.published) } as T) : null;
}

export async function getVisibleAvatar(avatarId: string, userId: string | null): Promise<VisibleAvatar | null> {
  await ensureVisibilitySchema();
  const row = await db().prepare(
    `SELECT a.id,a.owner_id,a.type,a.asset_url FROM avatars a WHERE a.id=? AND (a.owner_id=? OR EXISTS (SELECT 1 FROM characters c WHERE c.avatar_id=a.id AND ${visibleCharacterWhere('c')}))`,
  ).get(avatarId,userId,...characterViewerArgs(userId));
  return row ? row as VisibleAvatar : null;
}

export async function setPublished(table: CommunityTable, entityId: string, ownerId: string, published: boolean): Promise<boolean> {
  if(table==='characters')return setCharacterVisibility(entityId,ownerId,published?'public':'private',[]);
  await ensureVisibilitySchema();
  const row = await db().prepare(`SELECT data FROM ${table} WHERE id=? AND owner_id=?`).get(entityId, ownerId);
  if (!row) return false;
  const data = { ...JSON.parse(row.data as string), published };
  const storedPublished = hasPostgres() ? (published ? "true" : "false") : published ? 1 : 0;
  const result = await db().prepare(`UPDATE ${table} SET published=?, data=? WHERE id=? AND owner_id=?`).run(storedPublished, JSON.stringify(data), entityId, ownerId);
  return result.changes === 1;
}

export class InvalidCharacterShare extends Error {}

export async function validateShareRecipients(ownerId:string,visibility:CharacterVisibility,friendIds:string[]):Promise<string[]>{
  const unique=[...new Set(friendIds)];
  if(visibility!=='selected')return [];
  if(!unique.length)throw new InvalidCharacterShare('Choose at least one friend to share with.');
  for(const friendId of unique){
    const accepted=await db().prepare("SELECT 1 FROM friendships WHERE status='accepted' AND ((user_a=? AND user_b=?) OR (user_a=? AND user_b=?))").get(ownerId,friendId,friendId,ownerId);
    if(!accepted)throw new InvalidCharacterShare('Selected people must be accepted friends.');
  }
  return unique;
}

export async function characterSharing(ownerId: string, characterId: string) {
  await ensureVisibilitySchema();
  const character=await db().prepare('SELECT visibility FROM characters WHERE id=? AND owner_id=?').get(characterId,ownerId);
  if(!character)return null;
  const rows=await db().prepare('SELECT user_id FROM character_shares WHERE character_id=? ORDER BY user_id').all(characterId);
  return {visibility:character.visibility as CharacterVisibility,friend_ids:rows.map(row=>row.user_id as string)};
}

export async function setCharacterVisibility(characterId:string,ownerId:string,visibility:CharacterVisibility,friendIds:string[]):Promise<boolean>{
  await ensureVisibilitySchema();
  return transaction(async()=>{
    const row=await db().prepare('SELECT data FROM characters WHERE id=? AND owner_id=?').get(characterId,ownerId);
    if(!row)return false;
    const unique=await validateShareRecipients(ownerId,visibility,friendIds);
    const published=visibility==='public';
    const data={...JSON.parse(row.data as string),visibility,published};
    const storedPublished=hasPostgres()?(published?'true':'false'):published?1:0;
    await db().prepare('UPDATE characters SET visibility=?,published=?,data=? WHERE id=? AND owner_id=?').run(visibility,storedPublished,JSON.stringify(data),characterId,ownerId);
    await db().prepare('DELETE FROM character_shares WHERE character_id=?').run(characterId);
    if(visibility==='selected')for(const friendId of unique)await db().prepare('INSERT INTO character_shares (character_id,user_id) VALUES (?,?)').run(characterId,friendId);
    return true;
  });
}
