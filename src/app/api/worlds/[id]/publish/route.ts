import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { setPublished } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest, ctx: Context) {
  const origin = req.headers.get("origin");
  const expected = new Set([req.nextUrl.origin, process.env.APP_URL].filter(Boolean));
  if (origin && !expected.has(origin)) return json({ error: "Request origin not allowed." }, 403);
  const user = await currentUser();
  if (!user) return json({ error: "Sign in is required." }, 401);
  const { id } = await ctx.params;
  let input: { published?: unknown };
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON request." }, 400); }
  const published = input.published !== false;
  const changed = await setPublished("worlds", id, user.id, published);
  if (!changed) return json({ error: "World not found or not owned by this account." }, 404);
  return json({ ok: true, published });
}
