import test from "node:test";
import assert from "node:assert/strict";
import { canUseRoute } from "../lib/permissions.js";

test("frontend route permission helper checks role lists", () => {
  assert.equal(canUseRoute("owner", ["owner"]), true);
  assert.equal(canUseRoute("admin", ["owner"]), false);
  assert.equal(canUseRoute("penjoki", ["owner", "admin", "penjoki"]), true);
});
