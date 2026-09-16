import test from "node:test";
import assert from "node:assert/strict";
import * as characterRoute from "../src/app/api/characters/[id]/route";
import * as characterPublishRoute from "../src/app/api/characters/[id]/publish/route";
import * as worldPublishRoute from "../src/app/api/worlds/[id]/publish/route";
import * as bootstrapRoute from "../src/app/api/bootstrap/route";
import * as avatarRoute from "../src/app/api/avatars/[id]/route";

test("specific API routes export every method used by their client callers", () => {
  assert.equal(typeof characterRoute.PATCH, "function", "CharacterDetail PATCH must not be shadowed by a DELETE-only specific route");
  assert.equal(typeof characterRoute.DELETE, "function");
  assert.equal(typeof characterPublishRoute.POST, "function");
  assert.equal(typeof worldPublishRoute.POST, "function");
  assert.equal(typeof bootstrapRoute.GET, "function");
  assert.equal(typeof avatarRoute.GET, "function");
});
