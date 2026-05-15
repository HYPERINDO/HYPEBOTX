const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createDatabase } = require("../database/connection");
const { createTicketRepository } = require("../repositories/ticketRepository");
const { createOrderRepository } = require("../repositories/orderRepository");
const { createJokiRepository } = require("../repositories/jokiRepository");
const { createSimpleStoreRepository } = require("../repositories/simpleStoreRepository");

function createTempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-race-"));
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
    info() { },
    warn() { },
    error() { },
  };
}

test("ticket repository create is safe under concurrent writes", async () => {
  const paths = createTempPaths();
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();
  const ticketRepository = createTicketRepository(database);

  const total = 80;
  await Promise.all(
    Array.from({ length: total }, (_, index) =>
      ticketRepository.create({
        id: String(index + 1).padStart(4, "0"),
        guildId: "guild-1",
        channelId: `channel-${index + 1}`,
        openerId: `user-${index + 1}`,
        status: "open",
      })),
  );

  const rows = await ticketRepository.getAll();
  assert.equal(rows.length, total);
  assert.equal(new Set(rows.map((row) => row.id)).size, total);
});

test("ticket repository allocateNextId remains unique under concurrency", async () => {
  const paths = createTempPaths();
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();
  const ticketRepository = createTicketRepository(database);

  const total = 60;
  const ids = await Promise.all(
    Array.from({ length: total }, () => ticketRepository.allocateNextId()),
  );

  assert.equal(ids.length, total);
  assert.equal(new Set(ids).size, total);
  assert.equal(ids.includes("0001"), true);
});

test("ticket repository getAllByGuildId filters by guild", async () => {
  const paths = createTempPaths();
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();
  const ticketRepository = createTicketRepository(database);

  await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      ticketRepository.create({
        id: String(index + 1).padStart(4, "0"),
        guildId: "guild-a",
        channelId: `channel-a-${index + 1}`,
        openerId: `user-a-${index + 1}`,
        status: "open",
      }),
    ),
  );

  await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      ticketRepository.create({
        id: String(index + 11).padStart(4, "0"),
        guildId: "guild-b",
        channelId: `channel-b-${index + 1}`,
        openerId: `user-b-${index + 1}`,
        status: "open",
      }),
    ),
  );

  const guildATickets = await ticketRepository.getAllByGuildId("guild-a");
  const guildBTickets = await ticketRepository.getAllByGuildId("guild-b");

  assert.equal(guildATickets.length, 10);
  assert.equal(guildBTickets.length, 8);
  assert.ok(guildATickets.every((row) => row.guildId === "guild-a"));
  assert.ok(guildBTickets.every((row) => row.guildId === "guild-b"));
});

test("order repository create is safe under concurrent writes", async () => {
  const paths = createTempPaths();
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();
  const orderRepository = createOrderRepository(database);

  const total = 80;
  await Promise.all(
    Array.from({ length: total }, (_, index) =>
      orderRepository.create({
        id: `ORD-${index + 1}`,
        guildId: "guild-1",
        ticketId: String(index + 1).padStart(4, "0"),
        userId: `user-${index + 1}`,
      })),
  );

  const rows = await orderRepository.getAll();
  assert.equal(rows.length, total);
  assert.equal(new Set(rows.map((row) => row.id)).size, total);
});

test("simple store repository getNextOrderId persists scoped counters safely", async () => {
  const paths = createTempPaths();
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();
  const simpleStoreRepository = createSimpleStoreRepository(database);

  const guildA = "guild-A";
  const guildB = "guild-B";

  const results = await Promise.all([
    simpleStoreRepository.getNextOrderId(guildA),
    simpleStoreRepository.getNextOrderId(guildA),
    simpleStoreRepository.getNextOrderId(guildB),
  ]);

  assert.deepEqual(results.sort(), ["HYP-0001", "HYP-0002", "HYP-0001"].sort());
});

test("database supports legacy orderCounter_* file keys", async () => {
  const paths = createTempPaths();
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();

  const legacyKey = "orderCounter_guild-legacy";

  await database.write(legacyKey, 7);

  const legacyValue = await database.read(legacyKey, 0);
  const counters = await database.read("counters", {});

  assert.equal(legacyValue, 7);
  assert.equal(counters[legacyKey], 7);
});

test("database normalizes legacy orderCounter_* file keys with extra whitespace", async () => {
  const paths = createTempPaths();
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();

  const rawLegacyKey = "   orderCounter_guild-legacy-whitespace   ";
  const normalizedLegacyKey = "orderCounter_guild-legacy-whitespace";

  await database.write(rawLegacyKey, 11);

  const legacyValue = await database.read(rawLegacyKey, 0);
  const counters = await database.read("counters", {});

  assert.equal(legacyValue, 11);
  assert.equal(counters[normalizedLegacyKey], 11);
});

test("joki queue addToQueue is safe under concurrent writes", async () => {
  const paths = createTempPaths();
  const logger = createSilentLogger();
  const database = createDatabase(paths, logger);
  database.init();
  const jokiRepository = createJokiRepository({ database, logger });

  const total = 50;
  await Promise.all(
    Array.from({ length: total }, (_, index) =>
      jokiRepository.addToQueue("guild-1", {
        userId: `user-${index + 1}`,
        ticketId: String(index + 1).padStart(4, "0"),
        estimatedSeconds: 60,
      })),
  );

  const queue = await jokiRepository.getQueue("guild-1");
  assert.equal(queue.orders.length, total);
  assert.equal(new Set(queue.orders.map((row) => row.id)).size, total);
});
