import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import * as catchAllRoute from "../src/app/api/[...path]/route";
import * as characterCreateRoute from "../src/app/api/characters/route";
import * as characterRoute from "../src/app/api/characters/[id]/route";
import * as characterGenerateRoute from "../src/app/api/characters/generate/route";
import * as characterPublishRoute from "../src/app/api/characters/[id]/publish/route";
import * as worldGenerateRoute from "../src/app/api/worlds/generate/route";
import * as worldPublishRoute from "../src/app/api/worlds/[id]/publish/route";
import * as bootstrapRoute from "../src/app/api/bootstrap/route";
import * as characterArtRoute from "../src/app/api/characters/[id]/art/route";

test("specific API routes export every method used by their client callers", () => {
  assert.equal(typeof characterCreateRoute.POST, "function", "Character create must use a dedicated persistence route");
  assert.equal(typeof characterRoute.PATCH, "function", "CharacterDetail PATCH must not be shadowed by a DELETE-only specific route");
  assert.equal(typeof characterRoute.DELETE, "function");
  assert.equal(typeof characterGenerateRoute.POST, "function", "Static character generation must win over /characters/[id]");
  assert.equal(typeof characterPublishRoute.POST, "function");
  assert.equal(typeof worldGenerateRoute.POST, "function", "Static scenario generation must be a dedicated route");
  assert.equal(typeof worldPublishRoute.POST, "function");
  assert.equal(typeof bootstrapRoute.GET, "function");
  assert.equal(typeof characterArtRoute.GET, "function");
});

test("catch-all refuses paths owned by dedicated routes instead of serving stale fallbacks", async () => {
  const bootstrapFallback = await catchAllRoute.GET(
    new NextRequest("http://localhost/api/bootstrap"),
    { params: Promise.resolve({ path: ["bootstrap"] }) },
  );
  assert.equal(bootstrapFallback.status, 404);

  const generateFallback = await catchAllRoute.POST(
    new NextRequest("http://localhost/api/characters/generate", { method: "POST" }),
    { params: Promise.resolve({ path: ["characters", "generate"] }) },
  );
  assert.equal(generateFallback.status, 404);

  for (const [url, path] of [
    ["http://localhost/api/characters/char-a/publish", ["characters", "char-a", "publish"]],
    ["http://localhost/api/worlds/world-a/publish", ["worlds", "world-a", "publish"]],
    ["http://localhost/api/characters/char-a/art", ["characters", "char-a", "art"]],
  ] as const) {
    const response = await catchAllRoute.POST(
      new NextRequest(url, { method: "POST" }),
      { params: Promise.resolve({ path: [...path] }) },
    );
    assert.equal(response.status, 404);
  }
});
