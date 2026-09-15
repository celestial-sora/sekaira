import { randomUUID } from "node:crypto";
import { db, transaction, hasPostgres } from "./database";
export { db, transaction } from "./database";
import type {
  Character,
  World,
  Persona,
  Conversation,
  Message,
  Memory,
} from "./types";
export class DatabaseContextError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "DatabaseContextError";
  }
}
export type ConversationInput = {
  world_id: string | null;
  persona_id: string | null;
  scenario_id: string | null;
  character_ids: string[];
};
let initialized: Promise<void> | undefined;
export async function ensureDatabase() {
  initialized ??= transaction(() => seed(db())).catch((e) => {
    initialized = undefined;
    throw e;
  });
  await initialized;
  for (const statement of [
    "ALTER TABLE users ADD COLUMN email TEXT",
    "ALTER TABLE users ADD COLUMN admin INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN age_range TEXT NOT NULL DEFAULT 'general'",
    "ALTER TABLE users ADD COLUMN age_verified INTEGER NOT NULL DEFAULT 1",
  ]) {
    try { await db().prepare(statement).run(); } catch { /* already migrated */ }
  }
}
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
const tables = {
  characters: "characters",
  worlds: "worlds",
  personas: "personas",
} as const;
export async function list<T>(
  table: keyof typeof tables,
  userId: string | null,
): Promise<T[]> {
  return (
    await db()
      .prepare(
        `SELECT data, owner_id, users.name AS creator_name, users.picture AS creator_picture FROM ${tables[table]} LEFT JOIN users ON users.id = ${tables[table]}.owner_id WHERE ${tables[table]}.owner_id IS NULL OR ${tables[table]}.owner_id = ? ORDER BY ${tables[table]}.id DESC`,
      )
      .all(userId)
  ).map((r) => ({ ...JSON.parse(r.data as string), creator_name: r.creator_name ?? null, creator_picture: r.creator_picture ?? null }));
}
export async function get<T>(
  table: keyof typeof tables,
  entityId: string,
  userId: string | null,
): Promise<T | null> {
  const r = await db()
    .prepare(
      `SELECT data FROM ${tables[table]} WHERE id = ? AND (owner_id IS NULL OR owner_id = ?)`,
    )
    .get(entityId, userId);
  return r ? JSON.parse(r.data as string) : null;
}
export async function createCharacter(
  owner: string,
  data: Omit<Character, "id" | "owner_id" | "created_at">,
): Promise<Character> {
  const c = { ...data, id: id(), owner_id: owner, created_at: now() };
  await db()
    .prepare(
      "INSERT INTO characters (id,owner_id,world_id,scenario_id,avatar_id,data) VALUES (?,?,?,?,?,?)",
    )
    .run(
      c.id,
      owner,
      c.world_id,
      c.scenario_id,
      c.avatar_id,
      JSON.stringify(c),
    );
  if (c.world_id)
    await db()
      .prepare(
        "INSERT INTO world_characters (world_id,character_id) VALUES (?,?)",
      )
      .run(c.world_id, c.id);
  return c;
}
export async function updateCharacterTags(
  owner: string,
  characterId: string,
  tags: string[],
): Promise<Character | null> {
  const character = await get<Character>("characters", characterId, owner);
  if (!character || character.owner_id !== owner) return null;
  const updated = { ...character, tags };
  await db()
    .prepare("UPDATE characters SET data=? WHERE id=? AND owner_id=?")
    .run(JSON.stringify(updated), characterId, owner);
  return updated;
}
export async function createWorld(
  owner: string,
  data: Omit<World, "id" | "owner_id" | "created_at">,
): Promise<World> {
  const w = { ...data, id: id(), owner_id: owner, created_at: now() };
  await db()
    .prepare("INSERT INTO worlds (id,owner_id,data) VALUES (?,?,?)")
    .run(w.id, owner, JSON.stringify(w));
  return w;
}
export async function createPersona(
  owner: string,
  data: Omit<Persona, "id" | "owner_id" | "created_at">,
): Promise<Persona> {
  const p = { ...data, id: id(), owner_id: owner, created_at: now() };
  await db()
    .prepare(
      "INSERT INTO personas (id,owner_id,world_id,data) VALUES (?,?,?,?)",
    )
    .run(p.id, owner, p.world_id, JSON.stringify(p));
  return p;
}
export async function worldCharacters(
  worldId: string,
  owner: string | null,
): Promise<Character[]> {
  return (
    await db()
      .prepare(
        "SELECT c.data FROM characters c JOIN world_characters wc ON wc.character_id=c.id WHERE wc.world_id=? AND (c.owner_id IS NULL OR c.owner_id=?)",
      )
      .all(worldId, owner)
  ).map((r) => JSON.parse(r.data as string));
}
export async function conversations(owner: string): Promise<Conversation[]> {
  return Promise.all(
    (
      await db()
        .prepare(
          "SELECT * FROM conversations WHERE owner_id=? ORDER BY updated_at DESC",
        )
        .all(owner)
    ).map((r) => hydrateConversation(r)),
  );
}
async function hydrateConversation(
  r: Record<string, unknown>,
): Promise<Conversation> {
  const scene = (await db()
    .prepare("SELECT * FROM scenes WHERE conversation_id=?")
    .get(r.id as string))!;
  const ids = (
    await db()
      .prepare("SELECT character_id FROM scene_characters WHERE scene_id=?")
      .all(scene.id as string)
  ).map((c) => c.character_id as string);
  return { ...r, character_ids: ids, location: scene.location } as Conversation;
}
export async function conversation(
  convId: string,
  owner: string,
): Promise<Conversation | null> {
  const r = await db()
    .prepare("SELECT * FROM conversations WHERE id=? AND owner_id=?")
    .get(convId, owner);
  return r ? await hydrateConversation(r) : null;
}
export async function messages(convId: string): Promise<Message[]> {
  return (await db()
    .prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY rowid")
    .all(convId)) as unknown as Message[];
}
export async function memories(owner: string): Promise<Memory[]> {
  return (
    await db()
      .prepare(
        "SELECT * FROM memories WHERE owner_id=? ORDER BY created_at DESC",
      )
      .all(owner)
  ).map(
    (r) => ({ ...r, known_by: JSON.parse(r.known_by as string) }) as Memory,
  );
}
export async function addMessage(
  convId: string,
  role: Message["role"],
  characterId: string | null,
  content: string,
  emotion = "idle",
) {
  await db()
    .prepare(
      "INSERT INTO messages (id,conversation_id,role,character_id,content,emotion,created_at) VALUES (?,?,?,?,?,?,?)",
    )
    .run(id(), convId, role, characterId, content, emotion, now());
}
export function scope(c: Conversation) {
  return c.world_id
    ? `world:${c.world_id}:persona:${c.persona_id ?? ""}`
    : `character:${c.character_ids[0]}`;
}
export async function loadConversationContext(
  owner: string,
  input: ConversationInput,
): Promise<{
  characters: Character[];
  world: World | null;
  persona: Persona | null;
}> {
  if (
    input.character_ids.length < 1 ||
    input.character_ids.length > 5 ||
    new Set(input.character_ids).size !== input.character_ids.length
  )
    throw new DatabaseContextError(
      "Choose between one and five distinct characters.",
    );
  const loaded = await Promise.all(
    input.character_ids.map((cid) => get<Character>("characters", cid, owner)),
  );
  if (loaded.some((character): character is null => character === null))
    throw new DatabaseContextError("Character not found.", 404);
  const characters = loaded as Character[];
  if (!input.world_id) {
    if (input.persona_id || input.scenario_id || characters.length !== 1)
      throw new DatabaseContextError(
        "Standalone chat has one character and no required persona or scenario.",
      );
    return { characters, world: null, persona: null };
  }
  const [world, persona, availableRows, scenario] = await Promise.all([
    get<World>("worlds", input.world_id, owner),
    input.persona_id
      ? get<Persona>("personas", input.persona_id, owner)
      : Promise.resolve(null),
    db()
      .prepare("SELECT character_id FROM world_characters WHERE world_id=?")
      .all(input.world_id),
    input.scenario_id
      ? db()
          .prepare(
            "SELECT id FROM scenarios WHERE id=? AND world_id=? AND (owner_id IS NULL OR owner_id=?)",
          )
          .get(input.scenario_id, input.world_id, owner)
      : Promise.resolve(undefined),
  ]);
  if (!world) throw new DatabaseContextError("World not found.", 404);
  if (!persona || persona.world_id !== world.id)
    throw new DatabaseContextError("Choose a persona belonging to this world.");
  const available = new Set(
    availableRows.map((row) => row.character_id as string),
  );
  if (input.character_ids.some((characterId) => !available.has(characterId)))
    throw new DatabaseContextError(
      "Add your selected characters to this world first.",
    );
  if (input.scenario_id && !scenario)
    throw new DatabaseContextError("Scenario not found.", 404);
  return { characters, world, persona };
}
export async function startConversation(
  owner: string,
  input: ConversationInput,
): Promise<Conversation> {
  return await transaction(async () => {
    const { characters: chars, world } = await loadConversationContext(
      owner,
      input,
    );
    const cid = id(),
      stamp = now(),
      sceneId = id();
    await db()
      .prepare(
        "INSERT INTO conversations (id,owner_id,world_id,persona_id,scenario_id,name,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run(
        cid,
        owner,
        input.world_id,
        input.persona_id,
        input.scenario_id,
        world?.name || chars[0].name,
        JSON.stringify({ summary: world?.world_state || "", events: [] }),
        stamp,
        stamp,
      );
    await db()
      .prepare(
        "INSERT INTO scenes (id,conversation_id,location) VALUES (?,?,?)",
      )
      .run(
        sceneId,
        cid,
        world?.locations.split("\n")[0] || "An open beginning",
      );
    for (const char of chars) {
      await db()
        .prepare(
          "INSERT INTO scene_characters (scene_id,character_id) VALUES (?,?)",
        )
        .run(sceneId, char.id);
      if (char.greeting)
        await addMessage(cid, "assistant", char.id, char.greeting, "happy");
    }
    return (await conversation(cid, owner))!;
  });
}
async function seed(d: ReturnType<typeof db>) {
  if (hasPostgres())
    await d.prepare("SELECT pg_advisory_xact_lock(172939)").get();
  if (await d.prepare("SELECT id FROM worlds WHERE id=?").get("aetheria"))
    return;
  const world: World = {
    id: "aetheria",
    owner_id: null,
    name: "Aetheria",
    description:
      "A city above the clouds. An ancient promise. A story only you can write.",
    lore: "The floating city of Aetheria is held aloft by the Heartstone. Its light has begun to fade. The Skyward Guild and the Moon Archive disagree about its origin.",
    rules:
      "Magic has a cost. People know only what they witness or learn. The player controls their own choices.",
    locations:
      "Skyhaven Market\nThe Moon Archive\nCloudspire Gardens\nThe Heartstone",
    factions: "Skyward Guild\nMoon Archive",
    power_system: "Aether crystals hold finite magical energy.",
    timeline: "The first morning of the Lantern Festival.",
    world_state:
      "The city is peaceful. The Heartstone is dimming; only the archivists suspect why.",
    genre: "Fantasy",
    cover: "sky",
    created_at: now(),
  };
  await d
    .prepare("INSERT INTO worlds (id,owner_id,data) VALUES (?,?,?)")
    .run(world.id, null, JSON.stringify(world));
  const seeds = [
    [
      "lyra",
      "Lyra",
      "A warm-hearted celestial traveler with a curiosity for the ordinary.",
      "Curious, gentle, quietly witty",
      "The world feels a little brighter with you here. What is on your mind?",
      "Kind,Curious",
      null,
      "0",
    ],
    [
      "elara",
      "Elara",
      "Keeper of the Moon Archive, searching for a forgotten constellation.",
      "Thoughtful, observant, loyal",
      "*Elara closes a silver-bound book.* A new face in the archive. Are you looking for a story… or a secret?",
      "Wise,Gentle",
      "aetheria",
      "1",
    ],
    [
      "kael",
      "Kael",
      "A skyship captain who always takes the scenic route.",
      "Playful, brave, resourceful",
      "*Kael leans against the skyship railing.* Perfect timing. There is a whole sky out there. Where should we go?",
      "Bold,Playful",
      "aetheria",
      "2",
    ],
    [
      "mira",
      "Mira",
      "A garden mage who believes even the smallest things have a story.",
      "Warm, empathetic, determined",
      "*Mira brushes a glowing petal from her sleeve.* Welcome to Cloudspire. Would you like to walk with me?",
      "Warm,Devoted",
      "aetheria",
      "3",
    ],
    [
      "ren",
      "Ren",
      "A quiet guardian with a sharp mind and an unexpected sense of humor.",
      "Reserved, protective, dry humor",
      "*Ren offers a small nod.* The market is lively today. Stay close if this is your first visit.",
      "Calm,Loyal",
      "aetheria",
      "4",
    ],
  ];
  for (const [
    cid,
    name,
    description,
    personality,
    greeting,
    tags,
    worldId,
    avatar,
  ] of seeds) {
    const c: Character = {
      id: cid!,
      owner_id: null,
      name: name!,
      description: description!,
      personality: personality!,
      greeting: greeting!,
      tags: tags!.split(","),
      world_id: worldId,
      scenario_id: null,
      avatar: avatar!,
      avatar_id: null,
      backstory: description!,
      speaking_style:
        "Natural, expressive; short descriptions of actions in asterisks.",
      likes: "Meaningful conversations, discovering new places",
      dislikes: "Cruelty, broken promises",
      relationship_behavior:
        "Trust develops slowly through shared experiences. Respect boundaries.",
      example_dialogue:
        "User: Can I stay a while?\nCharacter: Of course. There is no hurry here.",
      lore: "",
      faction: "",
      created_at: now(),
    };
    await d
      .prepare(
        "INSERT INTO characters (id,owner_id,world_id,scenario_id,avatar_id,data) VALUES (?,?,?,?,?,?)",
      )
      .run(c.id, null, c.world_id, null, null, JSON.stringify(c));
    if (worldId)
      await d
        .prepare(
          "INSERT INTO world_characters (world_id,character_id) VALUES (?,?)",
        )
        .run(worldId, cid!);
  }
}
