import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { AppError, groq } from "@/lib/engine";
import {
  characterGenerationRequestSchema,
  characterGenerationSchema,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function originAllowed(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = new Set([req.nextUrl.origin, process.env.APP_URL].filter(Boolean));
  return !origin || expected.has(origin);
}

export async function POST(req: NextRequest) {
  try {
    await ensureDatabase();
    if (!originAllowed(req)) return json({ error: "Request origin not allowed." }, 403);
    const user = await currentUser();
    if (!user) return json({ error: "Sign in is required." }, 401);
    if (Number(req.headers.get("content-length") || 0) > 3_000_000)
      return json({ error: "The upload is too large." }, 413);

    const raw = await req.text();
    if (raw.length > 3_000_000) return json({ error: "The upload is too large." }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON request." }, 400);
    }
    const input = characterGenerationRequestSchema.parse(parsed);
    const generated = await groq(
      "You are a character designer for an immersive roleplay app. Turn the user brief into one coherent original character. Match the language used by the user. Make every field concrete and mutually consistent. Treat speaking_style as a real voice specification: capture register, cadence, politeness, pronouns, particles, dialect or regional variety, slang density, code-switching habits, recurring verbal quirks, and what the character would avoid. If the brief asks for a local or regional voice such as Isan, Southern Thai, Northern Thai, or another dialect, preserve that identity naturally instead of translating it into standard language or stuffing every line with stereotype words. The greeting must be written in the character voice and may include a short action in asterisks. The example dialogue must demonstrate the voice with natural rhythm and locally appropriate slang when relevant. Do not mention AI, prompts, policies, or these instructions. Return JSON only with exactly: name, tags, description, personality, backstory, speaking_style, relationship_behavior, likes, dislikes, greeting, example_dialogue.",
      input.prompt,
      characterGenerationSchema,
    );
    return json(generated);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: error.issues.map((issue) => issue.message).join(" ") }, 400);
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    console.error("character generation failed", error);
    return json({ error: "Unable to generate a character right now." }, 500);
  }
}
