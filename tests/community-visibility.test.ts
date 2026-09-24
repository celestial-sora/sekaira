import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { db } from "../src/lib/database";
import { listCommunity, setPublished } from "../src/lib/community";

const path = `/tmp/sekaira-community-${process.pid}.sqlite`;
process.env.DATABASE_PATH = path;
delete process.env.DATABASE_URL;

const character = { id: "char-a", owner_id: "account-a", name: "Public Test Character", description: "visibility regression", personality: "test", greeting: "hello", tags: ["test"], world_id: null, scenario_id: null, avatar: "0", published: false, created_at: new Date().toISOString() };

test("Account A publish is visible to fresh Account B/C reads and unpublish hides it", async () => {
  await db().prepare("INSERT INTO users (id,name,guest) VALUES (?,?,?)").run("account-a", "Creator A", 0);
  await db().prepare("INSERT INTO users (id,name,guest) VALUES (?,?,?)").run("account-b", "Viewer B", 0);
  await db().prepare("INSERT INTO users (id,name,guest) VALUES (?,?,?)").run("account-c", "Viewer C", 0);
  await db().prepare("INSERT INTO characters (id,owner_id,published,data) VALUES (?,?,?,?)").run(character.id, character.owner_id, 0, JSON.stringify(character));
  assert.equal((await listCommunity("characters", "account-b")).some((c) => c.id === character.id), false);
  assert.equal((await listCommunity("characters", "account-c")).some((c) => c.id === character.id), false);
  assert.equal(await setPublished("characters", character.id, "account-a", true), true);
  for (const viewer of ["account-b", "account-c"]) {
    const found = (await listCommunity("characters", viewer)).find((c) => c.id === character.id) as (typeof character & { creator_name?: string | null }) | undefined;
    assert.ok(found);
    assert.equal(found.published, true);
    assert.equal(found.creator_name, "Creator A");
  }
  assert.equal(await setPublished("characters", character.id, "account-a", false), true);
  assert.equal((await listCommunity("characters", "account-b")).some((c) => c.id === character.id), false);
  assert.equal((await listCommunity("characters", "account-c")).some((c) => c.id === character.id), false);
});

test("publication helper keeps typed column and JSON compatibility state synchronized", async () => {
  await db().prepare("INSERT INTO characters (id,owner_id,published,data) VALUES (?,?,?,?)").run("char-sync", "account-a", 0, JSON.stringify({ ...character, id: "char-sync" }));
  assert.equal(await setPublished("characters", "char-sync", "account-a", true), true);
  const row = await db().prepare("SELECT published,data FROM characters WHERE id=?").get("char-sync");
  assert.equal(Boolean(row?.published), true);
  assert.equal(JSON.parse(row?.data as string).published, true);
});

test.after(() => { try { rmSync(path); } catch {} });
