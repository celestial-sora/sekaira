import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { Pool } from "pg";
import { db } from "../src/lib/database";
import { listCommunity, setPublished } from "../src/lib/community";
import { messages } from "../src/lib/db";
import { resilientBootstrap } from "../src/lib/bootstrap";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  test("PostgreSQL integration suite requires DATABASE_URL", { skip: true }, () => {});
} else {
  let setupPool: Pool | undefined;

  test.before(async () => {
    setupPool = new Pool({ connectionString: databaseUrl, ssl: false, max: 1 });
    const client = await setupPool.connect();
    try {
      await client.query("DROP SCHEMA IF EXISTS sekaira CASCADE");
      for (const role of ["anon", "authenticated"]) {
        try {
          await client.query(`CREATE ROLE ${role} NOLOGIN`);
        } catch (error) {
          if ((error as { code?: string }).code !== "42710") throw error;
        }
      }
      const migrations = readdirSync("supabase/migrations")
        .filter((name) => name.endsWith(".sql"))
        .sort();
      for (const migration of migrations) {
        await client.query(readFileSync(`supabase/migrations/${migration}`, "utf8"));
      }
    } finally {
      client.release();
    }
  });

  test.after(async () => {
    await setupPool?.end();
  });

  test("migrations plus production SQL adapter support publication, bootstrap, ordering, nullable comparisons, ignore inserts, and trust clamps", async () => {
    for (const [id, name] of [
      ["account-a", "Creator A"],
      ["account-b", "Viewer B"],
      ["account-c", "Viewer C"],
    ] as const) {
      await db().prepare("INSERT INTO users (id,name,guest) VALUES (?,?,?)").run(id, name, 0);
    }

    const character = {
      id: "char-a",
      owner_id: "account-a",
      name: "Postgres Community Character",
      description: "production adapter regression",
      personality: "test",
      greeting: "hello",
      tags: ["test"],
      world_id: null,
      scenario_id: null,
      avatar: "0",
      avatar_id: null,
      published: false,
      created_at: "2026-09-16T00:00:00.000Z",
    };
    await db()
      .prepare("INSERT INTO characters (id,owner_id,published,data) VALUES (?,?,?,?)")
      .run(character.id, character.owner_id, 0, JSON.stringify(character));

    assert.equal((await listCommunity("characters", "account-b")).some((item) => item.id === character.id), false);
    assert.equal(await setPublished("characters", character.id, "account-a", true), true);

    const publishedRow = await db().prepare("SELECT published,data FROM characters WHERE id=?").get(character.id);
    assert.equal(publishedRow?.published, true);
    assert.equal(JSON.parse(publishedRow?.data as string).published, true);

    for (const viewer of ["account-b", "account-c"] as const) {
      const visible = (await listCommunity("characters", viewer)).find((item) => item.id === character.id);
      assert.ok(visible);
      assert.equal(visible.creator_name, "Creator A");
    }

    const bootstrapB = await resilientBootstrap({
      id: "account-b",
      email: null,
      name: "Viewer B",
      picture: null,
      guest: false,
      admin: false,
      age_range: "general",
      age_verified: true,
    });
    assert.equal(bootstrapB.degraded, undefined);
    assert.ok(bootstrapB.characters.some((item) => item.id === character.id));

    await db().prepare("INSERT INTO worlds (id,owner_id,published,data) VALUES (?,?,?,?)").run(
      "world-a",
      "account-a",
      0,
      JSON.stringify({ id: "world-a", owner_id: "account-a", name: "World A", published: false }),
    );
    const firstLink = await db().prepare("INSERT OR IGNORE INTO world_characters (world_id,character_id) VALUES (?,?)").run("world-a", character.id);
    const duplicateLink = await db().prepare("INSERT OR IGNORE INTO world_characters (world_id,character_id) VALUES (?,?)").run("world-a", character.id);
    assert.equal(firstLink.changes, 1);
    assert.equal(duplicateLink.changes, 0);

    await db().prepare("INSERT INTO scenarios (id,world_id,owner_id,data) VALUES (?,?,?,?)").run("scenario-null", null, "account-a", "{}");
    const nullable = await db().prepare("SELECT id FROM scenarios WHERE owner_id=? AND world_id IS ?").get("account-a", null);
    assert.equal(nullable?.id, "scenario-null");

    const trustUpsert = "INSERT INTO relationships (owner_id,scope,character_id,trust,note) VALUES (?,?,?,?,?) ON CONFLICT(owner_id,scope,character_id) DO UPDATE SET trust=MAX(-100,MIN(100,relationships.trust+excluded.trust)),note=CASE WHEN excluded.note='' THEN relationships.note ELSE excluded.note END";
    await db().prepare(trustUpsert).run("account-b", "character:char-a", character.id, 99, "start");
    await db().prepare(trustUpsert).run("account-b", "character:char-a", character.id, 5, "");
    const relationship = await db().prepare("SELECT trust,note FROM relationships WHERE owner_id=? AND scope=? AND character_id=?").get("account-b", "character:char-a", character.id);
    assert.equal(relationship?.trust, 100);
    assert.equal(relationship?.note, "start");

    await db().prepare("INSERT INTO conversations (id,owner_id,world_id,persona_id,scenario_id,name,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(
      "conversation-a",
      "account-b",
      null,
      null,
      null,
      "Ordering test",
      "{}",
      "2026-09-16T00:00:00.000Z",
      "2026-09-16T00:00:00.000Z",
    );
    await db().prepare("INSERT INTO messages (id,conversation_id,role,character_id,content,emotion,created_at) VALUES (?,?,?,?,?,?,?)").run(
      "message-late",
      "conversation-a",
      "user",
      null,
      "late",
      "idle",
      "2026-09-16T00:02:00.000Z",
    );
    await db().prepare("INSERT INTO messages (id,conversation_id,role,character_id,content,emotion,created_at) VALUES (?,?,?,?,?,?,?)").run(
      "message-early",
      "conversation-a",
      "user",
      null,
      "early",
      "idle",
      "2026-09-16T00:01:00.000Z",
    );
    const ordered = await messages("conversation-a");
    assert.deepEqual(ordered.map((message) => message.id), ["message-early", "message-late"]);

    assert.equal(await setPublished("characters", character.id, "account-a", false), true);
    const bootstrapC = await resilientBootstrap({
      id: "account-c",
      email: null,
      name: "Viewer C",
      picture: null,
      guest: false,
      admin: false,
      age_range: "general",
      age_verified: true,
    });
    assert.equal(bootstrapC.characters.some((item) => item.id === character.id), false);
  });
}
