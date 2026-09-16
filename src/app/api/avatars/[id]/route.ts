import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getVisibleAvatar } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, ctx: Context) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const avatar = await getVisibleAvatar(id, user?.id ?? null);
  if (!avatar) return json({ error: "Avatar not found." }, 404);
  return json(avatar);
}
