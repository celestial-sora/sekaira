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
import { resilientBootstrap } from "@/lib/bootstrap";
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
  if ((path[0] === "characters" || path[0] === "worlds") && path[1] && path[2] === "publish" && method === "POST") {
    if (!user) fail("Sign in is required.", 401);
    const table = path[0] === "characters" ? "characters" : "worlds";
    const item = await get<Character | World>(table, path[1], user.id);
    if (!item || item.owner_id !== user.id) fail("You can only publish your own content.", 403);
    const published = (await body(req)).published !== false;
    await db().prepare(`UPDATE ${table} SET data=? WHERE id=? AND owner_id=?`).run(JSON.stringify({ ...item, published }), path[1], user.id);
    return json({ ok: true, published });
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
    return json(await resilientBootstrap(user));
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
