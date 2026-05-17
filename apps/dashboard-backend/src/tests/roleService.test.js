import test from "node:test";
import assert from "node:assert/strict";
import { ROLES } from "@hypebotx/shared";
import { isActiveStaff, normalizeRole, resolveDashboardRole, roleCan } from "../services/roleService.js";

test("role service normalizes dashboard roles", () => {
  assert.equal(normalizeRole("OWNER"), ROLES.OWNER);
  assert.equal(normalizeRole("admin"), ROLES.ADMIN);
  assert.equal(normalizeRole("penjoki"), ROLES.PENJOKI);
  assert.equal(normalizeRole("customer"), null);
});

test("role service rejects inactive staff", () => {
  assert.equal(isActiveStaff({ status: "suspended" }), false);
  assert.equal(resolveDashboardRole("not-owner", { role: "admin", status: "inactive" }), null);
});

test("role service exposes shared permission matrix", () => {
  assert.equal(roleCan(ROLES.OWNER, "settings:manage"), true);
  assert.equal(roleCan(ROLES.PENJOKI, "payments:monitor"), false);
});
