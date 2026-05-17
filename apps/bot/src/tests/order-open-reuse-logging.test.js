const test = require("node:test");
const assert = require("node:assert/strict");

const { createOrderService } = require("../services/orderService");

function createInteraction(userId = "user-1") {
  return {
    guild: { id: "guild-1", name: "Guild One" },
    member: { id: `member-${userId}` },
    user: { id: userId, tag: `${userId}#0001` },
  };
}

function createService({ existingOrder, ticketOpenerId = "user-1" } = {}) {
  const calls = {
    logSecurity: [],
    logOrder: [],
  };

  const service = createOrderService({
    botConfig: {},
    logger: { info() { }, warn() { }, error() { } },
    repositories: {
      orderRepository: {
        async findByTicketId() {
          return existingOrder || null;
        },
        async create() {
          throw new Error("should not create order in reuse flow");
        },
      },
      simpleStoreRepository: {
        async getNextOrderId() {
          return "HYP-0002";
        },
      },
    },
    ticketService: {
      async createTicketChannel() {
        return {
          reused: true,
          channel: { id: "channel-1" },
          ticket: { id: "0042", openerId: ticketOpenerId },
        };
      },
    },
    roleService: {},
    loggingService: {
      async logSecurity(...args) {
        calls.logSecurity.push(args);
      },
      async logOrder(...args) {
        calls.logOrder.push(args);
      },
    },
    getJokiService: () => null,
    statusSyncService: null,
  });

  return { service, calls };
}

test("openOrder reuse does not raise security log when ownership matches", async () => {
  const { service, calls } = createService({
    existingOrder: { id: "HYP-0001", userId: "user-1" },
    ticketOpenerId: "user-1",
  });

  await service.openOrder(createInteraction("user-1"), "repeat click");

  assert.equal(calls.logSecurity.length, 0);
  assert.equal(calls.logOrder.length, 0);
});

test("openOrder reuse raises security log when ownership mismatches", async () => {
  const { service, calls } = createService({
    existingOrder: { id: "HYP-0001", userId: "another-user" },
    ticketOpenerId: "another-user",
  });

  await service.openOrder(createInteraction("user-1"), "repeat click");

  assert.equal(calls.logSecurity.length, 1);
  assert.equal(calls.logSecurity[0][1], "Order Reuse Ownership Mismatch");
  assert.equal(calls.logOrder.length, 0);
});
