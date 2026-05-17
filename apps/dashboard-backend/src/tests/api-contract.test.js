import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hypebotx-dashboard-api-"));
const botStore = path.join(tempRoot, "bot-store");
const dashboardStore = path.join(tempRoot, "dashboard-store");
const testDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDir, "..", "..");
const envFileName = ".env.test-api-contract";

process.env.BOT_STORAGE_DIR = botStore;
process.env.DASHBOARD_STORAGE_DIR = dashboardStore;
process.env.DASHBOARD_SESSION_SECRET = "test-session-secret";
process.env.OWNER_DISCORD_IDS = "owner-1";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.ENV_FILE = envFileName;

await fs.writeFile(
  path.join(appRoot, envFileName),
  [
    `BOT_STORAGE_DIR=${botStore.replaceAll("\\", "/")}`,
    `DASHBOARD_STORAGE_DIR=${dashboardStore.replaceAll("\\", "/")}`,
    "DASHBOARD_SESSION_SECRET=test-session-secret",
    "OWNER_DISCORD_IDS=owner-1",
    "FRONTEND_URL=http://localhost:5173",
  ].join("\n"),
  "utf8",
);
process.once("exit", () => {
  try {
    fsSync.unlinkSync(path.join(appRoot, envFileName));
  } catch {
    // test cleanup best effort
  }
});

const { createApp } = await import("../app.js");

async function writeJson(name, data) {
  await fs.mkdir(botStore, { recursive: true });
  await fs.writeFile(path.join(botStore, name), JSON.stringify(data, null, 2), "utf8");
}

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(botStore, name), "utf8"));
}

async function seed() {
  await fs.rm(botStore, { recursive: true, force: true });
  await fs.rm(dashboardStore, { recursive: true, force: true });
  await fs.mkdir(botStore, { recursive: true });
  await fs.mkdir(dashboardStore, { recursive: true });

  await writeJson("orders.json", [
    { id: "ord-1", order_code: "ORD-1", customer_discord_id: "member-1", status: "waiting_payment", payment_status: "pending", service_type: "joki", amount: 100000 },
  ]);
  await writeJson("payments.json", [
    { id: "pay-1", invoice_code: "INV-1", order_id: "ord-1", method: "qris", amount: 100000, status: "pending" },
  ]);
  await writeJson("tickets.json", [
    { id: "tck-1", order_id: "ord-1", status: "open", claimed_by: null },
  ]);
  await writeJson("users.json", [
    { id: "owner-1", discordId: "owner-1", username: "Owner", role: "owner", status: "active" },
    { id: "admin-1", discordId: "admin-1", username: "Admin", role: "admin", status: "active" },
    { id: "joki-1", discordId: "joki-1", username: "Joki", role: "penjoki", status: "active" },
    { id: "member-1", discordId: "member-1", username: "Member", role: "member", status: "active" },
  ]);
  await writeJson("stock-items.json", [
    { id: "prd-1", name: "Windows 11 Pro", price: 150000, is_active: true },
  ]);
  await writeJson("stock-units.json", [
    { id: "stk-1", product_id: "prd-1", status: "available", content: "SECRET-LICENSE-KEY" },
  ]);
  await writeJson("joki-queues.json", {
    guild: {
      guildId: "guild",
      orders: [{ id: "job-1", order_id: "ord-1", package_name: "Paket Joki", status: "waiting", assigned_joki_id: "joki-1" }],
      history: [],
    },
  });
  await writeJson("audit-logs.json", []);
}

async function clientAs(role = null) {
  const app = createApp();
  app.get("/__test/login/:role", (req, res) => {
    const selectedRole = req.params.role;
    const discordId = selectedRole === "owner" ? "owner-1" : selectedRole === "admin" ? "admin-1" : selectedRole === "penjoki" ? "joki-1" : "member-1";
    req.session.user = { discordId, userId: discordId, username: selectedRole, role: selectedRole };
    res.json({ ok: true });
  });

  const agent = request.agent(app);
  if (role) await agent.get(`/__test/login/${role}`).expect(200);
  return agent;
}

test("dashboard API contract: unauthenticated routes are protected", async () => {
  await seed();
  const api = await clientAs();

  for (const route of ["/api/dashboard/overview", "/api/orders", "/api/payments", "/api/tickets", "/api/joki/queue", "/api/staff", "/api/stock", "/api/audit-logs"]) {
    const response = await api.get(route);
    assert.equal(response.status, 401, route);
    assert.equal(response.body.success, false);
  }
});

test("dashboard API contract: role guards reject insufficient roles", async () => {
  await seed();
  const penjoki = await clientAs("penjoki");
  assert.equal((await penjoki.get("/api/orders")).status, 403);
  assert.equal((await penjoki.get("/api/payments")).status, 403);
  assert.equal((await penjoki.get("/api/staff")).status, 403);

  const admin = await clientAs("admin");
  assert.equal((await admin.get("/api/staff")).status, 403);
  assert.equal((await admin.get("/api/owner/bot-status")).status, 403);
});

test("dashboard API contract: owner and admin can read operational resources", async () => {
  await seed();
  const owner = await clientAs("owner");
  const admin = await clientAs("admin");

  assert.equal((await owner.get("/api/owner/overview")).status, 200);
  assert.equal((await owner.get("/api/audit-logs")).status, 200);
  assert.equal((await owner.get("/api/staff")).status, 200);
  assert.equal((await admin.get("/api/orders")).body.orders.length, 1);
  assert.equal((await admin.get("/api/payments")).body.payments.length, 1);
  assert.equal((await admin.get("/api/tickets")).body.tickets.length, 1);
  assert.equal((await admin.get("/api/customers")).body.customers.length, 4);
});

test("dashboard API contract: order management writes state and audit logs", async () => {
  await seed();
  const admin = await clientAs("admin");
  const owner = await clientAs("owner");

  assert.equal((await admin.patch("/api/orders/ord-1/status").send({ status: "processing" })).body.order.status, "processing");
  assert.equal((await admin.patch("/api/orders/ord-1/assign-admin").send({ adminId: "admin-1" })).body.order.assigned_admin_id, "admin-1");
  assert.equal((await admin.patch("/api/orders/ord-1/assign-joki").send({ jokiId: "joki-1" })).body.order.assigned_joki_id, "joki-1");
  assert.equal((await admin.post("/api/orders/ord-1/note").send({ note: "priority" })).body.order.notes, "priority");
  assert.equal((await admin.post("/api/orders/ord-1/cancel")).body.order.status, "cancelled");
  assert.equal((await owner.post("/api/orders/ord-1/refund")).body.order.payment_status, "refunded");

  const audit = await readJson("audit-logs.json");
  assert.ok(audit.some((row) => row.action === "ORDER_STATUS_CHANGED"));
  assert.ok(audit.some((row) => row.action === "ORDER_REFUNDED"));
});

test("dashboard API contract: payment actions are audited and id-addressable", async () => {
  await seed();
  const admin = await clientAs("admin");

  assert.equal((await admin.get("/api/payments/pay-1")).body.payment.id, "pay-1");
  assert.equal((await admin.post("/api/payments/pay-1/approve")).body.payment.status, "paid");
  assert.equal((await admin.post("/api/payments/pay-1/reject").send({ reason: "bad proof" })).body.payment.reject_reason, "bad proof");
  assert.equal((await admin.post("/api/payments/pay-1/sync")).body.synced, true);

  const audit = await readJson("audit-logs.json");
  assert.ok(audit.some((row) => row.action === "PAYMENT_APPROVED"));
  assert.ok(audit.some((row) => row.action === "PAYMENT_REJECTED"));
});

test("dashboard API contract: ticket actions update ticket lifecycle", async () => {
  await seed();
  const admin = await clientAs("admin");

  assert.equal((await admin.get("/api/tickets/tck-1")).body.ticket.id, "tck-1");
  assert.equal((await admin.post("/api/tickets/tck-1/claim")).body.ticket.claimed_by, "admin-1");
  assert.equal((await admin.post("/api/tickets/tck-1/close")).body.ticket.status, "closed");
  assert.equal((await admin.post("/api/tickets/tck-1/reopen")).body.ticket.status, "open");
  assert.equal((await admin.post("/api/tickets/tck-1/note").send({ note: "ok" })).body.saved, true);
});

test("dashboard API contract: joki queue supports worker and admin actions", async () => {
  await seed();
  const penjoki = await clientAs("penjoki");
  const admin = await clientAs("admin");

  assert.equal((await penjoki.get("/api/joki/queue")).body.queue.length, 1);
  assert.equal((await penjoki.get("/api/joki/my-jobs")).body.jobs.length, 1);
  assert.equal((await penjoki.post("/api/joki/jobs/job-1/claim")).body.job.claimedBy, "joki-1");
  assert.equal((await penjoki.post("/api/joki/jobs/job-1/progress").send({ status: "on_progress", note: "50%" })).body.job.status, "on_progress");
  assert.equal((await penjoki.post("/api/joki/jobs/job-1/submit-done").send({ proofUrl: "https://example.test/proof.png" })).body.job.admin_review_status, "pending");
  assert.equal((await admin.post("/api/joki/jobs/job-1/approve")).body.job.admin_review_status, "approved");
  assert.equal((await admin.post("/api/joki/jobs/job-1/reject").send({ reason: "fix" })).body.job.reject_reason, "fix");
  assert.equal((await admin.post("/api/joki/jobs/job-1/reassign").send({ jokiId: "joki-2" })).body.job.assigned_joki_id, "joki-2");
});

test("dashboard API contract: staff manager create update suspend activate remove", async () => {
  await seed();
  const owner = await clientAs("owner");

  const created = await owner.post("/api/staff").send({ discordId: "admin-2", username: "Admin Two", role: "admin" });
  assert.equal(created.status, 201);
  const id = created.body.staff.id;
  assert.equal((await owner.patch(`/api/staff/${id}`).send({ role: "penjoki" })).body.staff.role, "penjoki");
  assert.equal((await owner.post(`/api/staff/${id}/suspend`)).body.staff.status, "suspended");
  assert.equal((await owner.post(`/api/staff/${id}/activate`)).body.staff.status, "active");
  assert.equal((await owner.delete(`/api/staff/${id}`)).body.staff.status, "inactive");
});

test("dashboard API contract: product and stock actions mask secrets", async () => {
  await seed();
  const owner = await clientAs("owner");
  const admin = await clientAs("admin");

  assert.equal((await admin.get("/api/stock")).body.stock[0].hasSecretContent, true);
  assert.equal((await admin.get("/api/stock")).body.stock[0].content, undefined);
  assert.equal((await owner.post("/api/products").send({ name: "Office 2024", price: 250000 })).status, 201);
  assert.equal((await owner.patch("/api/products/prd-1").send({ price: 175000 })).body.product.price, 175000);
  assert.equal((await owner.delete("/api/products/prd-1")).body.deleted, true);
  assert.equal((await admin.post("/api/stock").send({ product_id: "prd-1", status: "available", content: "SECRET" })).status, 201);
  assert.equal((await admin.post("/api/stock/stk-1/reserve").send({ orderId: "ord-1" })).body.stock.status, "reserved");
  assert.equal((await admin.post("/api/stock/stk-1/mark-sold")).body.stock.status, "sold");
  assert.equal((await owner.delete("/api/stock/stk-1")).body.deleted, true);
});

test("dashboard API contract: customer, logs, and owner operations are consistent", async () => {
  await seed();
  const admin = await clientAs("admin");
  const owner = await clientAs("owner");

  assert.equal((await admin.get("/api/customers/member-1")).body.customer.discordId, "member-1");
  assert.equal((await admin.post("/api/customers/member-1/note").send({ note: "vip" })).body.customer.internal_note, "vip");
  assert.equal((await admin.post("/api/customers/member-1/blacklist-request").send({ reason: "fraud" })).status, 202);
  assert.equal((await admin.get("/api/logs/order")).status, 200);
  assert.equal((await owner.get("/api/owner/bot-status")).body.status.service, "hypebotx-bot");
  assert.equal((await owner.post("/api/owner/bot/restart")).status, 202);
  assert.equal((await owner.post("/api/owner/backup")).status, 202);
  assert.ok(Array.isArray((await owner.get("/api/owner/ai-usage")).body.usage));
});

test("dashboard API contract: missing resources return 404 without stack traces", async () => {
  await seed();
  const admin = await clientAs("admin");

  for (const route of ["/api/orders/missing", "/api/payments/missing", "/api/tickets/missing", "/api/joki/jobs/missing", "/api/products/missing", "/api/customers/missing"]) {
    const response = await admin.get(route);
    assert.equal(response.status, 404, route);
    assert.equal(response.body.success, false);
    assert.equal(Object.hasOwn(response.body, "stack"), false);
  }
});
