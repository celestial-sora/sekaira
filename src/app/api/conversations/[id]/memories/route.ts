import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { conversation, db, ensureDatabase, id, now } from "@/lib/db";
import type { Conversation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

function originAllowed(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = new Set([req.nextUrl.origin, process.env.APP_URL].filter(Boolean));
  return !origin || expected.has(origin);
}

async function chatData(conv: Conversation, owner: string) {
  const rows = await db()
    .prepare("SELECT * FROM memories WHERE owner_id=? ORDER BY created_at DESC")
    .all(owner);
  const memories = rows
    .map((row) => ({ ...row, known_by: JSON.parse(row.known_by as string) }))
    .filter((memory) =>
      conv.world_id
        ? memory.world_id === conv.world_id && memory.persona_id === conv.persona_id
        : !memory.world_id && memory.character_id === conv.character_ids[0],
    );
  return { memories };
}

export async function POST(req: NextRequest, ctx: Context) {
  try {
    await ensureDatabase();
    if (!originAllowed(req)) return json({ error: "Request origin not allowed." }, 403);
    const user = await currentUser();
    if (!user) return json({ error: "Sign in is required." }, 401);
    const { id: conversationId } = await ctx.params;
    const conv = await conversation(conversationId, user.id);
    if (!conv) return json({ error: "Conversation not found." }, 404);
    const input = z
      .object({ content: z.string().trim().min(1).max(1000), private: z.boolean().default(true) })
      .parse(await req.json());

    await db()
      .prepare(
        "INSERT INTO memories (id,owner_id,conversation_id,world_id,persona_id,character_id,type,content,importance,confidence,known_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id(),
        user.id,
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

    return json(await chatData(conv, user.id));
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: error.issues.map((issue) => issue.message).join(" ") }, 400);
    console.error("memory create failed", error);
    return json({ error: "Unable to save this memory right now." }, 500);
  }
}
