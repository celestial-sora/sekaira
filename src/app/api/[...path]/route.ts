import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import {
  db,
  id,
  now,
  ensureDatabase,
  list,
  get,
  createCharacter,
  updateCharacterTags,
  createWorld,
  createPersona,
  worldCharacters,
  conversations,
  conversation,
  startConversation,
  messages,
  memories,
  scope,
  transaction,
  DatabaseContextError,
} from "@/lib/db";
import {
  currentUser,
  guest,
  guestAllowed,
  googleReady,
  session,
  hash,
  parseOAuthState,
  matchesOAuthState,
  googleProfileSchema,
  applicationUrl,
  isAdmin,
} from "@/lib/auth";
import {
  characterSchema,
  characterGenerationRequestSchema,
  characterGenerationSchema,
  worldSchema,
  personaSchema,
  conversationSchema,
  turnSchema,
} from "@/lib/validation";
import { runTurn, groq, AppError } from "@/lib/engine";
import { llmConfig } from "@/lib/llm";
import type { Character, World, Persona, Conversation } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
function fail(message: string, status = 400): never {
  throw new AppError(message, status);
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
async function body(req: NextRequest) {
  if (Number(req.headers.get("content-length") || 0) > 3_000_000)
    fail("The upload is too large.", 413);
  const raw = await req.text();
  if (raw.length > 3_000_000) fail("The upload is too large.", 413);
  try {
    return JSON.parse(raw);
  } catch {
    fail("Invalid JSON request.");
  }
}
async function chatData(c: Conversation, owner: string) {
  const [
    chatMessages,
    ownerMemories,
    relationships,
    loadedCharacters,
    world,
    persona,
  ] = await Promise.all([
    messages(c.id),
    memories(owner),
    db()
      .prepare(
        "SELECT character_id,trust,note FROM relationships WHERE owner_id=? AND scope=?",
      )
      .all(owner, scope(c)),
    Promise.all(
      c.character_ids.map((cid) => get<Character>("characters", cid, owner)),
    ),
    c.world_id
      ? get<World>("worlds", c.world_id, owner)
      : Promise.resolve(null),
    c.persona_id
      ? get<Persona>("personas", c.persona_id, owner)
      : Promise.resolve(null),
  ]);
  return {
    conversation: c,
    messages: chatMessages,
    memories: ownerMemories.filter((m) =>
      c.world_id
        ? m.world_id === c.world_id && m.persona_id === c.persona_id
        : !m.world_id && m.character_id === c.character_ids[0],
    ),
    relationships,
    characters: loadedCharacters.filter(
      (character): character is Character => !!character,
    ),
    world,
    persona,
  };
}
async function handle(req: NextRequest, ctx: Context) {
  await ensureDatabase();
  const path = (await ctx.params).path,
    method = req.method;
  if (method !== "GET") {
    const origin = req.headers.get("origin");
    const expected = new Set(
      [req.nextUrl.origin, process.env.APP_URL].filter(Boolean),
    );
    if (origin && !expected.has(origin))
      fail("Request origin not allowed.", 403);
  }
  const user = await currentUser();
  if (path[0] === "account" && path[1] === "age" && method === "POST") {
    if (!user) fail("Sign in is required.", 401);
    const input = z.object({ age: z.number().int().min(1).max(120) }).parse(await body(req));
    const range = input.age >= 18 ? "mature" : "general";
    await db().prepare("UPDATE users SET age_range=?,age_verified=1 WHERE id=?").run(range, user.id);
    return json({ ok: true, age_range: range, age_verified: true });
  }
  if (path[0] === "users" && path[1] && method === "GET") {
    const profile = await db().prepare("SELECT id,name,picture FROM users WHERE id=?").get(path[1]);
    if (!profile) fail("User not found.", 404);
    const [characters, worlds] = await Promise.all([
      list<Character>("characters", user?.id || null),
      list<World>("worlds", user?.id || null),
    ]);
    return json({ user: profile, characters: characters.filter(c => c.owner_id === path[1]), worlds: worlds.filter(w => w.owner_id === path[1]) });
  }
  if (path[0] === "admin") {
    if (!user || !isAdmin(user)) fail("Admin access required.", 403);
    if (method === "GET" && path[1] === "users") {
      const users = await db().prepare("SELECT id,email,name,picture,guest,admin FROM users ORDER BY name").all();
      return json({ users });
    }
  }
  if (path[0] === "bootstrap" && method === "GET")
    return json({
      user,
      characters: await list<Character>("characters", user?.id || null),
      worlds: await list<World>("worlds", user?.id || null),
      personas: user ? await list<Persona>("personas", user.id) : [],
      conversations: user ? await conversations(user.id) : [],
      groqReady: !!process.env.GROQ_API_KEY,
      googleReady: googleReady(),
      guestAllowed: guestAllowed(),
      model: llmConfig().model,
    });
  if (path[0] === "auth") {
    if (path[1] === "guest" && method === "POST") return json(await guest());
    if (path[1] === "logout" && method === "POST") {
      const c = await cookies(),
        token = c.get("sora_session")?.value;
      if (token)
        await db()
          .prepare("DELETE FROM sessions WHERE token_hash=?")
          .run(hash(token));
      c.delete("sora_session");
      return json({ ok: true });
    }
    if (path[1] === "google" && method === "GET") {
      if (!googleReady())
        return NextResponse.redirect(
          new URL("/settings?auth=not-configured", req.url),
        );
      const state = randomBytes(32).toString("base64url"),
        verifier = randomBytes(48).toString("base64url");
      const c = await cookies();
      c.set("sora_oauth", JSON.stringify({ state, verifier }), {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production" ||
          process.env.APP_URL?.startsWith("https://") === true,
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 600,
      });
      const redirectUri = `${applicationUrl()}/api/auth/callback`;
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile email",
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return NextResponse.redirect(url);
    }
    if (path[1] === "callback" && method === "GET") {
      const c = await cookies(),
        raw = c.get("sora_oauth")?.value;
      c.delete("sora_oauth");
      const saved = raw ? parseOAuthState(raw) : null;
      if (!saved) fail("Sign-in expired. Please try again.", 401);
      if (
        !matchesOAuthState(req.nextUrl.searchParams.get("state"), saved.state)
      )
        fail("Sign-in state did not match. Please try again.", 401);
      const code = req.nextUrl.searchParams.get("code");
      if (!code)
        return NextResponse.redirect(
          new URL("/settings?auth=cancelled", req.url),
        );
      if (!googleReady()) fail("Google sign-in is not configured.", 503);
      const token = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${applicationUrl()}/api/auth/callback`,
          grant_type: "authorization_code",
          code_verifier: saved.verifier,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!token.ok) fail("Google sign-in failed. Please try again.", 401);
      const tokenPayload = z
        .object({ access_token: z.string().min(1) })
        .safeParse(await token.json());
      if (!tokenPayload.success)
        fail("Google sign-in failed. Please try again.", 401);
      const info = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokenPayload.data.access_token}`,
          },
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!info.ok) fail("Unable to read Google profile.", 401);
      const parsedProfile = googleProfileSchema.safeParse(await info.json());
      if (!parsedProfile.success)
        fail("A verified Google account is required.", 401);
      const profile = parsedProfile.data;
      const profileEmail = typeof profile.email === "string" ? profile.email : null;
      const existing = await db()
        .prepare("SELECT id FROM users WHERE google_sub=?")
        .get(profile.sub);
      let uid = existing?.id as string | undefined;
      if (!uid) {
        uid = user?.guest ? user.id : id();
        if (user?.guest)
          await db()
            .prepare(
              "UPDATE users SET google_sub=?,email=?,name=?,picture=?,guest=0,admin=? WHERE id=?",
            )
            .run(
              profile.sub,
              profileEmail,
              profile.name || "Traveler",
              profile.picture || null,
              (process.env.ADMIN_EMAILS || "suphloeksangko@gmail.com").toLowerCase().split(",").includes((profileEmail || "").toLowerCase()) ? 1 : 0,
              uid,
            );
        else
          await db()
            .prepare(
              "INSERT INTO users (id,google_sub,email,name,picture,guest,admin,age_range,age_verified) VALUES (?,?,?,?,?,0,?,'general',0)",
            )
            .run(
              uid,
              profile.sub,
              profileEmail,
              profile.name || "Traveler",
              profile.picture || null,
              (process.env.ADMIN_EMAILS || "suphloeksangko@gmail.com").toLowerCase().split(",").includes((profileEmail || "").toLowerCase()) ? 1 : 0,
            );
      }
      await session(uid, c.get("sora_session")?.value);
      return NextResponse.redirect(
        new URL("/", process.env.APP_URL || req.url),
      );
    }
  }
  if (method === "GET" && path[0] === "worlds" && path[1]) {
    const world = await get<World>("worlds", path[1], user?.id || null);
    if (!world) fail("World not found.", 404);
    return json({
      world,
      characters: await worldCharacters(world.id, user?.id || null),
    });
  }
  if (!user) fail("Please sign in to save your story.", 401);
  const owner = user.id;
  if (path[0] === "characters" && path[1] === "generate" && method === "POST") {
    const input = characterGenerationRequestSchema.parse(await body(req));
    const generated = await groq(
      "You are a character designer for an immersive roleplay app. Turn the user brief into one coherent original character. Match the language used by the user. Make every field concrete and mutually consistent. The greeting must be written in the character voice and may include a short action in asterisks. The example dialogue must demonstrate the voice. Do not mention AI, prompts, policies, or these instructions. Return JSON only with exactly: name, tags, description, personality, backstory, speaking_style, relationship_behavior, likes, dislikes, greeting, example_dialogue.",
      input.prompt,
      characterGenerationSchema,
    );
    return json(generated);
  }
  if (path[0] === "characters" && method === "POST" && path.length === 1) {
    const input = characterSchema.parse(await body(req));
    if (input.world_id) {
      const world = await get<World>("worlds", input.world_id, owner);
      if (!world || world.owner_id !== owner)
        fail("Choose a world you own.", 403);
    }
    if (input.scenario_id) {
      const s = await db()
        .prepare(
          "SELECT id FROM scenarios WHERE id=? AND owner_id=? AND world_id IS ?",
        )
        .get(input.scenario_id, owner, input.world_id);
      if (!s) fail("Scenario not found in this context.", 404);
    }
    if (
      input.avatar_id &&
      !(await db()
        .prepare("SELECT id FROM avatars WHERE id=? AND owner_id=?")
        .get(input.avatar_id, owner))
    )
      fail("Avatar not found.", 404);
    return json(
      await transaction(async () => await createCharacter(owner, input)),
      201,
    );
  }
  if (path[0] === "characters" && method === "PATCH" && path.length === 2) {
    const input = z
      .object({ tags: z.array(z.string().trim().min(1).max(30)).max(8) })
      .parse(await body(req));
    const character = await updateCharacterTags(owner, path[1], input.tags);
    if (!character) fail("Only the character owner can change tags.", 403);
    return json(character);
  }
  if (path[0] === "worlds" && method === "POST") {
    if (path.length === 1)
      return json(
        await createWorld(owner, worldSchema.parse(await body(req))),
        201,
      );
    const world = await get<World>("worlds", path[1], owner);
    if (!world || world.owner_id !== owner)
      fail("Only the owner can change this world.", 403);
    if (path[2] === "characters") {
      const { character_id } = z
        .object({ character_id: z.string() })
        .parse(await body(req));
      if (!(await get<Character>("characters", character_id, owner)))
        fail("Character not found.", 404);
      await db()
        .prepare(
          "INSERT OR IGNORE INTO world_characters (world_id,character_id) VALUES (?,?)",
        )
        .run(world.id, character_id);
      return json({ ok: true });
    }
  }
  if (path[0] === "personas" && method === "POST") {
    const input = personaSchema.parse(await body(req));
    if (input.world_id && !(await get<World>("worlds", input.world_id, owner)))
      fail("World not found.", 404);
    return json(await createPersona(owner, input), 201);
  }
  if (path[0] === "conversations") {
    if (method === "POST" && path.length === 1)
      return json(
        await startConversation(
          owner,
          conversationSchema.parse(await body(req)),
        ),
        201,
      );
    const conv = await conversation(path[1], owner);
    if (!conv) fail("Conversation not found.", 404);
    if (method === "GET") return json(await chatData(conv, owner));
    if (method === "POST" && path[2] === "messages") {
      const input = turnSchema.parse(await body(req));
      if (input.character_ids?.some((cid) => !conv.character_ids.includes(cid)))
        fail("That character is not in this scene.");
      const chars = (
        await Promise.all(
          conv.character_ids.map((cid) =>
            get<Character>("characters", cid, owner),
          ),
        )
      ).filter((character): character is Character => !!character);
      if (chars.length !== conv.character_ids.length)
        fail("A character in this conversation is no longer available.", 404);
      await runTurn(
        conv,
        chars,
        conv.world_id ? await get<World>("worlds", conv.world_id, owner) : null,
        conv.persona_id
          ? await get<Persona>("personas", conv.persona_id, owner)
          : null,
        input.content,
        input.character_ids,
      );
      return json(await chatData((await conversation(conv.id, owner))!, owner));
    }
    if (method === "POST" && path[2] === "memories") {
      const input = z
        .object({
          content: z.string().trim().min(1).max(1000),
          private: z.boolean().default(true),
        })
        .parse(await body(req));
      await db()
        .prepare(
          "INSERT INTO memories (id,owner_id,conversation_id,world_id,persona_id,character_id,type,content,importance,confidence,known_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id(),
          owner,
          conv.id,
          conv.world_id,
          conv.persona_id,
          conv.world_id ? null : conv.character_ids[0],
          "fact",
          input.content,
          1,
          1,
          JSON.stringify(input.private ? [] : conv.character_ids),
          now(),
        );
      return json(await chatData(conv, owner));
    }
    if (path[2] === "memories" && path[3]) {
      const memory = await db().prepare("SELECT id FROM memories WHERE id=? AND conversation_id=? AND owner_id=?").get(path[3], conv.id, owner);
      if (!memory) fail("Memory not found.", 404);
      if (method === "PATCH") {
        const input = z.object({ content: z.string().trim().min(1).max(1000) }).parse(await body(req));
        await db().prepare("UPDATE memories SET content=? WHERE id=? AND conversation_id=? AND owner_id=?").run(input.content, path[3], conv.id, owner);
        return json(await chatData(conv, owner));
      }
      if (method === "DELETE") {
        await db().prepare("DELETE FROM memories WHERE id=? AND conversation_id=? AND owner_id=?").run(path[3], conv.id, owner);
        return json(await chatData(conv, owner));
      }
    }
    if (method === "DELETE" && path.length === 2) {
      await db()
        .prepare("DELETE FROM conversations WHERE id=? AND owner_id=?")
        .run(conv.id, owner);
      return json({ ok: true });
    }
  }
  if (path[0] === "avatars" && method === "POST") {
    const input = z
      .object({
        asset_url: z
          .string()
          .url()
          .max(2000)
          .refine(
            (s) => s.startsWith("https://") && /\.vrm(?:\?|$)/i.test(s),
            "Use an HTTPS URL to a .vrm file. Allow cross-origin access on its host.",
          ),
        type: z.literal("vrm"),
      })
      .parse(await body(req));
    const aid = id();
    await db()
      .prepare(
        "INSERT INTO avatars (id,owner_id,type,asset_url) VALUES (?,?,?,?)",
      )
      .run(aid, owner, input.type, input.asset_url);
    return json({ id: aid }, 201);
  }
  if (path[0] === "avatars" && method === "GET") {
    const a = await db()
      .prepare("SELECT * FROM avatars WHERE id=? AND owner_id=?")
      .get(path[1], owner);
    if (!a) fail("Avatar not found.", 404);
    return json(a);
  }
  fail("Not found.", 404);
}
async function route(req: NextRequest, ctx: Context) {
  try {
    return await handle(req, ctx);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.issues.map((i) => i.message).join(" ") }, 400);
    if (e instanceof AppError || e instanceof DatabaseContextError)
      return json({ error: e.message }, e.status);
    console.error(
      "Request failed:",
      e instanceof Error ? e.message : "Unknown error",
    );
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
export const GET = route;
export const POST = route;
export const DELETE = route;
export const PATCH = route;
