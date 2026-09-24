import { db, hasPostgres, transaction } from "./database";
import { characterViewerArgs, visibleCharacterWhere } from "./character-access";
import type { Character, CharacterVisibility, World } from "./types";
import type { z } from 'zod';
import type { characterUpdateSchema } from './validation';

type CommunityTable = "characters" | "worlds";
type CommunityEntity = Character | World;
export type VisibleAvatar = { id: string; owner_id: string; type: string; asset_url: string };

// Uploaded artwork is stored in the character JSON. Keep it out of catalog and
// bootstrap JSON so one large image does not delay every page and every viewer.
function servedArtwork<T extends Character>(character: T): T {
  return character.avatar?.startsWith('data:image/')
    ? {...character,avatar:`/api/characters/${encodeURIComponent(character.id)}/art`}
    : character;
}

export async function characterArtwork(characterId:string,viewerId:string|null):Promise<{type:string;bytes:Uint8Array}|null>{
  await ensureVisibilitySchema();
  const row=await db().prepare(
    `SELECT c.data FROM characters c WHERE c.id=? AND ${visibleCharacterWhere('c')}`,
  ).get(characterId,...characterViewerArgs(viewerId));
  if(!row)return null;
  const avatar=(JSON.parse(row.data as string) as {avatar?:unknown}).avatar;
  if(typeof avatar!=='string')return null;
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(avatar);
  if(!match)return null;
  return {type:match[1],bytes:new Uint8Array(Buffer.from(match[2],'base64'))};
}

let visibilitySchemaReady: Promise<void> | undefined;

export async function ensureVisibilitySchema() {
  if (!hasPostgres()) return;
  visibilitySchemaReady ??= (async () => {
    await db().prepare([
      "ALTER TABLE characters ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE",
      "UPDATE characters SET published = COALESCE((data::jsonb ->> 'published')::boolean, FALSE) WHERE published = FALSE AND data IS NOT NULL",
      "ALTER TABLE worlds ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE",
      "UPDATE worlds SET published = COALESCE((data::jsonb ->> 'published')::boolean, FALSE) WHERE published = FALSE AND data IS NOT NULL",
      "ALTER TABLE characters ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'",
      "UPDATE characters SET visibility='public' WHERE published=TRUE AND visibility='private'",
      "UPDATE characters SET visibility=data::jsonb ->> 'visibility',published=CASE WHEN data::jsonb ->> 'visibility'='public' THEN TRUE ELSE published END WHERE visibility='private' AND data IS NOT NULL AND data::jsonb ->> 'visibility' IN ('public','friends','selected')",
      "CREATE INDEX IF NOT EXISTS character_visibility ON sekaira.characters(visibility,owner_id)",
      "CREATE TABLE IF NOT EXISTS sekaira.friendships (user_a TEXT NOT NULL REFERENCES sekaira.users(id) ON DELETE CASCADE,user_b TEXT NOT NULL REFERENCES sekaira.users(id) ON DELETE CASCADE,requested_by TEXT NOT NULL REFERENCES sekaira.users(id) ON DELETE CASCADE,status TEXT NOT NULL CHECK(status IN ('pending','accepted')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_a,user_b),CHECK(user_a<user_b),CHECK(requested_by=user_a OR requested_by=user_b))",
      "CREATE INDEX IF NOT EXISTS friendship_user_b ON sekaira.friendships(user_b,status)",
      "CREATE TABLE IF NOT EXISTS sekaira.character_shares (character_id TEXT NOT NULL REFERENCES sekaira.characters(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES sekaira.users(id) ON DELETE CASCADE,PRIMARY KEY(character_id,user_id))",
      "CREATE INDEX IF NOT EXISTS character_shares_user ON sekaira.character_shares(user_id,character_id)",
      "ALTER TABLE sekaira.friendships ENABLE ROW LEVEL SECURITY",
      "ALTER TABLE sekaira.character_shares ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON sekaira.friendships,sekaira.character_shares FROM PUBLIC,anon,authenticated",
    ].join(';')).run();
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
    return rows.map((row) => servedArtwork({
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
    return row ? (servedArtwork({...JSON.parse(row.data as string),published:Boolean(row.published),visibility:row.owner_id===null?'public':row.visibility}) as T) : null;
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

export async function updateCharacterDetails(characterId:string,ownerId:string,input:z.infer<typeof characterUpdateSchema>):Promise<Character|null>{
 await ensureVisibilitySchema();
 return transaction(async()=>{
  const row=await db().prepare('SELECT data,visibility FROM characters WHERE id=? AND owner_id=?').get(characterId,ownerId);
  if(!row)return null;
  const visibility=(input.visibility??row.visibility) as CharacterVisibility;
  const priorShares=visibility==='selected'&&input.friend_ids===undefined
   ?(await db().prepare('SELECT user_id FROM character_shares WHERE character_id=?').all(characterId)).map(item=>item.user_id as string)
   :[];
  const friendIds=await validateShareRecipients(ownerId,visibility,input.friend_ids??priorShares);
  const {friend_ids:_friendIds,...changes}=input;
  const published=visibility==='public';
  const previous=JSON.parse(row.data as string) as Character;
  const updated={...previous,...changes,visibility,published} as Character;
  const storedPublished=hasPostgres()?(published?'true':'false'):published?1:0;
  await db().prepare('UPDATE characters SET visibility=?,published=?,data=? WHERE id=? AND owner_id=?').run(visibility,storedPublished,JSON.stringify(updated),characterId,ownerId);
  if(input.name&&input.name!==previous.name)await db().prepare('UPDATE conversations SET name=? WHERE world_id IS NULL AND name=? AND id IN (SELECT s.conversation_id FROM scenes s JOIN scene_characters sc ON sc.scene_id=s.id WHERE sc.character_id=?)').run(input.name,previous.name,characterId);
  await db().prepare('DELETE FROM character_shares WHERE character_id=?').run(characterId);
  if(visibility==='selected')for(const friendId of friendIds)await db().prepare('INSERT INTO character_shares (character_id,user_id) VALUES (?,?)').run(characterId,friendId);
  return updated;
 });
}
