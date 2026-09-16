import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { resilientBootstrap } from "@/lib/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let user: Awaited<ReturnType<typeof currentUser>> = null;
  const authFailures: string[] = [];

  try {
    user = await currentUser();
  } catch (error) {
    authFailures.push("auth:database");
    console.error("Bootstrap auth read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const payload = await resilientBootstrap(user);
  const failures = [...authFailures, ...(payload.failures ?? [])];

  return NextResponse.json(
    failures.length
      ? { ...payload, degraded: true, failures }
      : payload,
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
