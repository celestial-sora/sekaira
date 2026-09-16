import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import {
  conversation,
  db,
  ensureDatabase,
  get,
  memories,
  messages,
  scope,
} from "@/lib/db";
import { memoryBelongsToConversationScope } from "@/lib/memory";
import type { Character, Conversation, Memory, Persona, World } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; memoryId: string }> };

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

function originAllowed(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = new Set([req.nextUrl.origin, process.env.APP_URL].filter(Boolean));
  return !origin || expected.has(origin);
}

async function chatData(conv: Conversation, owner: string) {
  const [chatMessages, ownerMemories, relationships, loadedCharacters, world, persona] =
    await Promise.all([
      messages(conv.id),
      memories(owner),
      db()
        .prepare("SELECT character_id,trust,note FROM relationships WHERE owner_id=? AND scope=?")
        .all(owner, scope(conv)),
      Promise.all(conv.character_ids.map((characterId) => get<Character>("characters", characterId, owner))),
      conv.world_id ? get<World>("worlds", conv.world_id, owner) : Promise.resolve(null),
      conv.persona_id ? get<Persona>("personas", conv.persona_id, owner) : Promise.resolve(null),
    ]);
  return {
    conversation: conv,
    messages: chatMessages,
    memories: ownerMemories.filter((memory) => memoryBelongsToConversationScope(memory, conv)),
    relationships,
    characters: loadedCharacters.filter((character): character is Character => !!character),
    world,
    persona,
  };
}

async function context(req: NextRequest, ctx: Context) {
  await ensureDatabase();
  if (!originAllowed(req)) return { error: json({ error: "Request origin not allowed." }, 403) };
  const user = await currentUser();
  if (!user) return { error: json({ error: "Sign in is required." }, 401) };
  const { id: conversationId, memoryId } = await ctx.params;
  const conv = await conversation(conversationId, user.id);
  if (!conv) return { error: json({ error: "Conversation not found." }, 404) };
  const row = await db().prepare("SELECT * FROM memories WHERE id=? AND owner_id=?").get(memoryId, user.id);
  if (!row) return { error: json({ error: "Memory not found." }, 404) };
  const memory = { ...row, known_by: JSON.parse(row.known_by as string) } as unknown as Memory;
  if (!memoryBelongsToConversationScope(memory, conv))
    return { error: json({ error: "Memory is outside this conversation scope." }, 403) };
  return { user, conv, memoryId };
}

export async function PATCH(req: NextRequest, ctx: Context) {
  try {
    const resolved = await context(req, ctx);
    if ("error" in resolved) return resolved.error;
    const input = z.object({ content: z.string().trim().min(1).max(1000) }).strict().parse(await req.json());
    await db().prepare("UPDATE memories SET content=? WHERE id=? AND owner_id=?").run(
      input.content,
      resolved.memoryId,
      resolved.user.id,
    );
    return json(await chatData(resolved.conv, resolved.user.id));
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: error.issues.map((issue) => issue.message).join(" ") }, 400);
    console.error("memory update failed", error);
    return json({ error: "Unable to update this memory right now." }, 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Context) {
  try {
    const resolved = await context(req, ctx);
    if ("error" in resolved) return resolved.error;
    await db().prepare("DELETE FROM memories WHERE id=? AND owner_id=?").run(
      resolved.memoryId,
      resolved.user.id,
    );
    return json(await chatData(resolved.conv, resolved.user.id));
  } catch (error) {
    console.error("memory delete failed", error);
    return json({ error: "Unable to delete this memory right now." }, 500);
  }
}
