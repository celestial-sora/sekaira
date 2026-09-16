import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db, ensureDatabase, transaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(req: NextRequest, ctx: Context) {
  try {
    await ensureDatabase();
    const origin = req.headers.get("origin");
    const expected = new Set([req.nextUrl.origin, process.env.APP_URL].filter(Boolean));
    if (origin && !expected.has(origin)) return response({ error: "Request origin not allowed." }, 403);

    const user = await currentUser();
    if (!user) return response({ error: "Sign in is required." }, 401);

    const { id } = await ctx.params;
    const character = await db()
      .prepare("SELECT id,owner_id FROM characters WHERE id=?")
      .get(id);
    if (!character) return response({ error: "Character not found." }, 404);
    if (character.owner_id !== user.id)
      return response({ error: "Only the character owner can delete it." }, 403);

    await transaction(async () => {
      // Preserve conversation/message history where possible while removing live references.
      await db().prepare("UPDATE messages SET character_id=NULL WHERE character_id=?").run(id);
      await db().prepare("DELETE FROM memories WHERE character_id=?").run(id);
      await db().prepare("DELETE FROM relationships WHERE character_id=?").run(id);
      await db().prepare("DELETE FROM scene_characters WHERE character_id=?").run(id);
      await db().prepare("DELETE FROM world_characters WHERE character_id=?").run(id);
      const result = await db()
        .prepare("DELETE FROM characters WHERE id=? AND owner_id=?")
        .run(id, user.id);
      if (result.changes !== 1) throw new Error("Character deletion did not complete.");
    });

    return response({ ok: true, id });
  } catch (error) {
    console.error("character delete failed", error);
    return response({ error: "Unable to delete this character right now." }, 500);
  }
}
