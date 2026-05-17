/**
 * Shared test helpers for Business Acceptance Tests.
 *
 * Provides:
 * - Temp database creation
 * - Silent logger
 * - Fake Discord interaction/guild/member/channel mocks
 * - Repository factory
 * - Assertion helpers for heist invariants
 */
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../../src/database/connection");
const { createJokiRepository } = require("../../src/repositories/jokiRepository");
const { createOrderRepository } = require("../../src/repositories/orderRepository");
const { createTicketRepository } = require("../../src/repositories/ticketRepository");
const { createPaymentRepository } = require("../../src/repositories/paymentRepository");
const { createOpsRepository } = require("../../src/repositories/opsRepository");
const { createSimpleStoreRepository } = require("../../src/repositories/simpleStoreRepository");

// ── Temp database ──

function createTempPaths(prefix = "hypebotx-qa-biz-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    root,
    storage: {
      root: path.join(root, "storage"),
      backups: path.join(root, "storage", "backups"),
      transcripts: path.join(root, "storage", "transcripts"),
      temp: path.join(root, "storage", "temp"),
    },
  };
}

function createSilentLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {},
  };
}

function createTestDatabase(prefix) {
  const paths = createTempPaths(prefix);
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();
  return { database, logger, paths };
}

function createAllRepositories(database) {
  const jokiRepository = createJokiRepository({ database, logger: createSilentLogger() });
  const orderRepository = createOrderRepository(database);
  const ticketRepository = createTicketRepository(database);
  const paymentRepository = createPaymentRepository(database);
  const opsRepository = createOpsRepository(database);
  const simpleStoreRepository = createSimpleStoreRepository(database);
  return {
    jokiRepository,
    orderRepository,
    ticketRepository,
    paymentRepository,
    opsRepository,
    simpleStoreRepository,
  };
}

// ── Fake Discord objects ──

const GUILD_ID = "test-guild-001";
const STAFF_ID = "staff-001";
const CUSTOMER_ID = "customer-001";
const JOKI_ID = "joki-001";
const OWNER_ID = "owner-001";

function createFakeGuild(overrides = {}) {
  const channels = new Map();
  return {
    id: GUILD_ID,
    name: "Test Hyperindo",
    channels: {
      cache: channels,
      fetch: async (id) => channels.get(id) || null,
    },
    members: {
      cache: new Map(),
      fetch: async (id) => null,
    },
    ...overrides,
  };
}

function createFakeChannel(overrides = {}) {
  const messages = [];
  return {
    id: overrides.id || "channel-001",
    name: overrides.name || "test-channel",
    type: 0,
    isTextBased: () => true,
    send: async (content) => {
      const msg = { id: `msg-${Date.now()}`, ...content };
      messages.push(msg);
      return msg;
    },
    messages: {
      fetch: async () => new Map(),
    },
    _sent: messages,
    ...overrides,
  };
}

function createFakeMember({ userId, roles = [], isOwner = false } = {}) {
  const roleSet = new Set(roles);
  return {
    id: userId || CUSTOMER_ID,
    user: {
      id: userId || CUSTOMER_ID,
      tag: `user-${userId || CUSTOMER_ID}`,
      username: `user-${userId || CUSTOMER_ID}`,
    },
    roles: {
      cache: {
        has: (roleId) => roleSet.has(roleId),
        some: (fn) => [...roleSet].some((r) => fn({ id: r, name: r })),
        find: (fn) => [...roleSet].map((r) => ({ id: r, name: r })).find(fn),
        size: roleSet.size,
      },
    },
    permissions: {
      has: (perm) => isOwner,
    },
  };
}

function createFakeInteraction({
  userId = STAFF_ID,
  guildId = GUILD_ID,
  roles = ["Staff"],
  isOwner = false,
  options = {},
  channel = null,
} = {}) {
  const replies = [];
  const followUps = [];
  let replied = false;
  let deferred = false;

  const member = createFakeMember({ userId, roles, isOwner });
  const guild = createFakeGuild();

  const optionValues = { ...options };

  return {
    user: member.user,
    member,
    guild,
    channel: channel || createFakeChannel(),
    replied,
    deferred,
    options: {
      getString: (name, required) => optionValues[name] ?? (required ? "" : null),
      getInteger: (name, required) => optionValues[name] ?? (required ? 0 : null),
      getBoolean: (name) => optionValues[name] ?? null,
      getUser: (name) => optionValues[name] ?? null,
      getSubcommand: () => optionValues._subcommand ?? null,
    },
    reply: async (content) => {
      replied = true;
      replies.push(content);
      return content;
    },
    followUp: async (content) => {
      followUps.push(content);
      return content;
    },
    deferReply: async () => {
      deferred = true;
    },
    editReply: async (content) => {
      replies.push(content);
      return content;
    },
    _replies: replies,
    _followUps: followUps,
    get _lastReply() {
      return replies[replies.length - 1];
    },
    get _lastReplyContent() {
      const last = replies[replies.length - 1];
      return typeof last === "string" ? last : last?.content || "";
    },
  };
}

// ── Heist invariant assertion helpers ──

function assertHeistInvariant(order, assert) {
  const total = Number(order.totalHeist ?? 0);
  const completed = Number(order.completedHeist ?? 0);
  const remaining = Number(order.remainingHeist ?? 0);

  // completedHeist + remainingHeist = totalHeist
  assert.equal(
    completed + remaining,
    total,
    `Invariant violated: completed(${completed}) + remaining(${remaining}) != total(${total}) for order ${order.id}`,
  );

  // completedHeist tidak boleh > totalHeist
  assert.ok(
    completed <= total,
    `Invariant violated: completed(${completed}) > total(${total}) for order ${order.id}`,
  );

  // remainingHeist tidak boleh < 0
  assert.ok(
    remaining >= 0,
    `Invariant violated: remaining(${remaining}) < 0 for order ${order.id}`,
  );

  // todayCompletedHeist tidak boleh negatif
  const todayCompleted = Number(order.todayCompletedHeist ?? 0);
  assert.ok(
    todayCompleted >= 0,
    `Invariant violated: todayCompletedHeist(${todayCompleted}) < 0 for order ${order.id}`,
  );
}

function assertNotInActiveQueue(queue, orderId, assert) {
  const found = (queue?.orders || []).find((o) => o.id === orderId);
  assert.ok(!found, `Order ${orderId} should NOT be in active queue but was found`);
}

function assertInHistory(queue, orderId, assert) {
  const found = (queue?.history || []).find((o) => o.id === orderId);
  assert.ok(found, `Order ${orderId} should be in history but was NOT found`);
}

// ── Order label builder (matches real Discord format) ──

function buildOrderLabel({ platform = "ENHANCED", customer, orderId }) {
  return `🎮 ${platform}\n${customer}\nORDER ID: ${orderId}`;
}

module.exports = {
  createTempPaths,
  createSilentLogger,
  createTestDatabase,
  createAllRepositories,
  createFakeGuild,
  createFakeChannel,
  createFakeMember,
  createFakeInteraction,
  assertHeistInvariant,
  assertNotInActiveQueue,
  assertInHistory,
  buildOrderLabel,
  GUILD_ID,
  STAFF_ID,
  CUSTOMER_ID,
  JOKI_ID,
  OWNER_ID,
};
