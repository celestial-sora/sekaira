import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { conversation, db, ensureDatabase, scope, transaction } from "@/lib/db";

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

export async function DELETE(req: NextRequest, ctx: Context) {
  try {
    await ensureDatabase();
    if (!originAllowed(req)) return json({ error: "Request origin not allowed." }, 403);
    const user = await currentUser();
    if (!user) return json({ error: "Sign in is required." }, 401);
    const { id } = await ctx.params;
    const conv = await conversation(id, user.id);
    if (!conv) return json({ error: "Conversation not found." }, 404);

    await transaction(async () => {
      await db().prepare("DELETE FROM turn_locks WHERE conversation_id=?").run(conv.id);
      await db().prepare("DELETE FROM memories WHERE conversation_id=? AND owner_id=?").run(conv.id, user.id);
      await db().prepare("DELETE FROM messages WHERE conversation_id=?").run(conv.id);
      await db()
        .prepare("DELETE FROM scene_characters WHERE scene_id IN (SELECT id FROM scenes WHERE conversation_id=?)")
        .run(conv.id);
      await db().prepare("DELETE FROM scenes WHERE conversation_id=?").run(conv.id);
      await db().prepare("DELETE FROM relationships WHERE owner_id=? AND scope=?").run(user.id, scope(conv));
      const result = await db().prepare("DELETE FROM conversations WHERE id=? AND owner_id=?").run(conv.id, user.id);
      if (result.changes !== 1) throw new Error("Conversation deletion did not complete.");
    });

    return json({ ok: true, id: conv.id });
  } catch (error) {
    console.error("conversation delete failed", error);
    return json({ error: "Unable to delete this conversation right now." }, 500);
  }
}
