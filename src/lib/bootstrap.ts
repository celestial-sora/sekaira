import { list, conversations } from "@/lib/db";
import { listCommunity } from "@/lib/community";
import { guestAllowed, googleReady } from "@/lib/auth";
import { llmConfig } from "@/lib/llm";
import type { Bootstrap, Character, World, Persona } from "@/lib/types";

type BootstrapUser = Bootstrap["user"];
type FailureCategory = "network" | "schema" | "database";

function category(error: unknown): FailureCategory {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|ECONN|timeout|certificate|max clients/i.test(message)) return "network";
  if (/does not exist|undefined column|relation .* does not exist|json_extract|schema/i.test(message)) return "schema";
  return "database";
}

async function safe<T>(operation: string, fallback: T, run: () => Promise<T>, failures: string[]): Promise<T> {
  try { return await run(); }
  catch (error) {
    const kind = category(error);
    failures.push(`${operation}:${kind}`);
    console.error("Bootstrap read failed", { operation, category: kind, message: error instanceof Error ? error.message : "Unknown error" });
    return fallback;
  }
}

export async function resilientBootstrap(user: BootstrapUser): Promise<Bootstrap & { degraded?: boolean; failures?: string[] }> {
  const failures: string[] = [];
  const owner = user?.id || null;
  const [characters, worlds, personas, chats] = await Promise.all([
    safe("characters", [] as Character[], () => listCommunity<Character>("characters", owner), failures),
    safe("worlds", [] as World[], () => listCommunity<World>("worlds", owner), failures),
    user ? safe("personas", [] as Persona[], () => list<Persona>("personas", user.id), failures) : [],
    user ? safe("conversations", [], () => conversations(user.id), failures) : [],
  ]);
  return { user, characters, worlds, personas, conversations: chats, groqReady: !!process.env.GROQ_API_KEY, googleReady: googleReady(), guestAllowed: guestAllowed(), model: llmConfig().model, ...(failures.length ? { degraded: true, failures } : {}) };
}
