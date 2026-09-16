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
      "You are a character designer for an immersive roleplay app. Turn the user brief into one coherent original character and preserve the user's requested archetype, intensity, relationship dynamic, dialect, and mood instead of smoothing them into a generic friendly personality. Match the language used by the user. Treat archetype labels such as yandere, tsundere, kuudere, dandere, genki, possessive, jealous, reserved, dominant, or playful as behavioral directions that must be visible in personality, speaking_style, relationship_behavior, greeting, and example_dialogue. Make those fields concrete: describe triggers, habits, boundaries, emotional reactions, attachment style, and characteristic speech patterns. Do not reduce an intense archetype to a mild adjective list, but keep behavior coherent rather than repetitive or cartoonishly catchphrase-driven. The greeting must immediately demonstrate the character voice and relationship dynamic and may include a short action in asterisks. The example dialogue must show how the character reacts under pressure or to an archetype-relevant trigger. Keep tags concise and mutually consistent. Do not mention AI, prompts, policies, or these instructions. Return JSON only with exactly: name, tags, description, personality, backstory, speaking_style, relationship_behavior, likes, dislikes, greeting, example_dialogue.",
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
