const test = require("node:test");
const assert = require("node:assert/strict");

const { createStatusSyncService } = require("../services/statusSyncService");

test("status sync resolves ticket from queue id and updates queue/order/ticket", async () => {
  const calls = {
    queue: [],
    order: [],
    ticket: [],
  };

  const service = createStatusSyncService({
    logger: { error() { } },
    repositories: {
      jokiRepository: {
        async getOrderById(guildId, queueId) {
          assert.equal(guildId, "guild-1");
          assert.equal(queueId, "Q-1");
          return { id: "Q-1", ticketId: "0009" };
        },
        async setOrderStatus(guildId, queueId, changes) {
          calls.queue.push({ guildId, queueId, changes });
          return { guildId, queueId, changes };
        },
      },
      orderRepository: {
        async updateByTicketId(ticketId, changes) {
          calls.order.push({ ticketId, changes });
          return { ticketId, ...changes };
        },
      },
      ticketRepository: {
        async findById(ticketId) {
          return { id: ticketId, meta: { source: "seed" } };
        },
        async update(ticketId, changes) {
          calls.ticket.push({ ticketId, changes });
          return { id: ticketId, ...changes };
        },
      },
    },
  });

  const result = await service.syncTicketOrderQueueStatus({
    guildId: "guild-1",
    queueId: "Q-1",
    status: "processing",
    actorId: "staff-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.ticketId, "0009");
  assert.equal(calls.queue.length, 1);
  assert.equal(calls.queue[0].changes.status, "processing");
  assert.equal(calls.order.length, 1);
  assert.equal(calls.order[0].ticketId, "0009");
  assert.equal(calls.order[0].changes.status, "processing");
  assert.equal(calls.ticket.length, 1);
  assert.equal(calls.ticket[0].changes.orderStatus, "processing");
  assert.equal(calls.ticket[0].changes.claimedBy, "staff-1");
  assert.ok(calls.ticket[0].changes.claimedAt);
  assert.equal(calls.ticket[0].changes.meta.orderFlowStatus, "DIPROSES");
  assert.equal(calls.ticket[0].changes.meta.source, "seed");
});

test("status sync creates joki queue entry when missing (ticket -> queued/processing)", async () => {
  const calls = {
    ensureQueue: [],
    addToQueue: [],
    queueSetStatus: [],
    order: [],
    ticket: [],
    findById: [],
  };

  const service = createStatusSyncService({
    logger: { error() { } },
    repositories: {
      jokiRepository: {
        async getQueue() {
          // not used because queueOrder not found; we rely on autocreate path
          return { guildId: "guild-1", orders: [] };
        },
        async ensureQueue(guildId) {
          calls.ensureQueue.push(guildId);
        },
        async addToQueue(guildId, payload) {
          calls.addToQueue.push({ guildId, payload });
          return { id: "QUEUE-NEW", ticketId: payload.ticketId, userId: payload.userId };
        },
        async setOrderStatus(guildId, queueId, changes) {
          calls.queueSetStatus.push({ guildId, queueId, changes });
          return { guildId, queueId, changes };
        },
        async getOrderById() {
          return null;
        },
      },
      orderRepository: {
        async updateByTicketId(ticketId, changes) {
          calls.order.push({ ticketId, changes });
          return { ticketId, ...changes };
        },
      },
      ticketRepository: {
        async findById(ticketId) {
          calls.findById.push(ticketId);
          return {
            id: ticketId,
            openerId: "customer-1",
            meta: { formType: "joki", source: "seed" },
          };
        },
        async update(ticketId, changes) {
          calls.ticket.push({ ticketId, changes });
          return { id: ticketId, ...changes };
        },
      },
    },
  });

  const result = await service.syncTicketOrderQueueStatus({
    guildId: "guild-1",
    ticketId: "0009",
    status: "processing",
    actorId: "staff-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.queueOrderId, "QUEUE-NEW");
  assert.equal(result.ticketId, "0009");
  assert.equal(result.queueStatus, "processing");
  assert.equal(result.status, "processing");

  assert.deepEqual(calls.ensureQueue, ["guild-1"]);
  assert.equal(calls.addToQueue.length, 1);
  assert.equal(calls.addToQueue[0].payload.ticketId, "0009");
  assert.equal(calls.addToQueue[0].payload.userId, "customer-1");

  assert.equal(calls.queueSetStatus.length, 1);
  assert.equal(calls.queueSetStatus[0].queueId, "QUEUE-NEW");
  assert.equal(calls.queueSetStatus[0].changes.status, "processing");

  assert.equal(calls.order.length, 1);
  assert.equal(calls.order[0].ticketId, "0009");
  assert.equal(calls.order[0].changes.status, "processing");

  assert.equal(calls.ticket.length, 1);
  assert.equal(calls.ticket[0].ticketId, "0009");
  assert.equal(calls.ticket[0].changes.orderStatus, "processing");
  assert.equal(calls.ticket[0].changes.claimedBy, "staff-1");
  assert.ok(calls.ticket[0].changes.claimedAt);
  assert.equal(calls.ticket[0].changes.meta.orderFlowStatus, "DIPROSES");
  assert.equal(calls.ticket[0].changes.meta.source, "seed");
});

test("status sync records failure details without crashing", async () => {
  const errors = [];

  const service = createStatusSyncService({
    logger: {
      error(message, extra) {
        errors.push({ message, extra });
      },
    },
    repositories: {
      orderRepository: {
        async updateByTicketId() {
          throw new Error("order write failed");
        },
      },
      ticketRepository: {
        async findById(ticketId) {
          return { id: ticketId, meta: {} };
        },
        async update() {
          return { ok: true };
        },
      },
      jokiRepository: {},
    },
  });

  const result = await service.syncTicketOrderQueueStatus({
    guildId: "guild-2",
    ticketId: "0010",
    status: "completed",
    actorId: "staff-2",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.target === "order"));
  assert.ok(errors.some((entry) => entry.message === "status sync order update failed"));
});

test("status sync keeps hold state and maps flow to DIPROSES", async () => {
  const calls = {
    order: [],
    ticket: [],
  };

  const service = createStatusSyncService({
    logger: { error() { } },
    repositories: {
      orderRepository: {
        async updateByTicketId(ticketId, changes) {
          calls.order.push({ ticketId, changes });
          return { ticketId, ...changes };
        },
      },
      ticketRepository: {
        async findById(ticketId) {
          return { id: ticketId, meta: { source: "seed" } };
        },
        async update(ticketId, changes) {
          calls.ticket.push({ ticketId, changes });
          return { id: ticketId, ...changes };
        },
      },
      jokiRepository: {},
    },
  });

  const result = await service.syncTicketOrderQueueStatus({
    guildId: "guild-3",
    ticketId: "0011",
    status: "hold",
    actorId: "staff-3",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.order[0].changes.status, "hold");
  assert.equal(calls.ticket[0].changes.orderStatus, "hold");
  assert.equal(calls.ticket[0].changes.meta.orderFlowStatus, "DIPROSES");
});

test("status sync paid updates order paymentStatus and flow", async () => {
  const calls = {
    order: [],
    ticket: [],
  };

  const service = createStatusSyncService({
    logger: { error() { } },
    repositories: {
      orderRepository: {
        async updateByTicketId(ticketId, changes) {
          calls.order.push({ ticketId, changes });
          return { ticketId, ...changes };
        },
      },
      ticketRepository: {
        async findById(ticketId) {
          return { id: ticketId, meta: {} };
        },
        async update(ticketId, changes) {
          calls.ticket.push({ ticketId, changes });
          return { id: ticketId, ...changes };
        },
      },
      jokiRepository: {},
    },
  });

  const result = await service.syncTicketOrderQueueStatus({
    guildId: "guild-4",
    ticketId: "0012",
    status: "paid",
    actorId: "staff-4",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.order[0].changes.status, "paid");
  assert.equal(calls.order[0].changes.paymentStatus, "paid");
  assert.equal(calls.ticket[0].changes.meta.orderFlowStatus, "DIPROSES");
});
