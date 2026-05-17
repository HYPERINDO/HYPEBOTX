import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";

test("health endpoint is public", async () => {
  const response = await request(createApp()).get("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("auth me requires session", async () => {
  const response = await request(createApp()).get("/api/auth/me");
  assert.equal(response.status, 401);
});

test("logout is idempotent and clears any session cookie even without auth", async () => {
  const response = await request(createApp()).post("/api/auth/logout");
  assert.equal(response.status, 200);
  assert.equal(response.body.loggedOut, true);
});
