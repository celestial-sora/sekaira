import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";

const path = `/tmp/sekaira-bootstrap-${process.pid}.sqlite`;
process.env.DATABASE_PATH = path;
delete process.env.DATABASE_URL;

const { db } = await import("../src/lib/database");
const { resilientBootstrap } = await import("../src/lib/bootstrap");

test("bootstrap remains usable when one dataset read fails", async () => {
  await db().prepare("INSERT INTO users (id,name,guest) VALUES (?,?,?)").run("bootstrap-user", "Bootstrap User", 0);
  await db().prepare("DROP TABLE personas").run();

  const result = await resilientBootstrap({
    id: "bootstrap-user",
    email: null,
    name: "Bootstrap User",
    picture: null,
    guest: false,
    admin: false,
    age_range: "general",
    age_verified: true,
  });

  assert.equal(result.user?.id, "bootstrap-user");
  assert.equal(result.degraded, true);
  assert.deepEqual(result.personas, []);
  assert.ok(result.failures?.some((failure) => failure === "personas:schema"));
  assert.ok(Array.isArray(result.characters));
  assert.ok(Array.isArray(result.worlds));
  assert.ok(Array.isArray(result.conversations));
});

test.after(() => { try { rmSync(path); } catch {} });
