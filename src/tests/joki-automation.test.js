const test = require("node:test");
const assert = require("node:assert/strict");

const { createJokiRepository } = require("../repositories/jokiRepository");

function createMemoryDatabase() {
  const state = {
    jokiQueues: {},
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  return {
    async read(fileKey, fallback = null) {
      if (!Object.prototype.hasOwnProperty.call(state, fileKey)) {
        return clone(fallback);
      }
      return clone(state[fileKey]);
    },
    async write(fileKey, payload) {
      state[fileKey] = clone(payload);
      return clone(payload);
    },
    _state: state,
  };
}

test("joki repository isolates queues per guild", async () => {
  const database = createMemoryDatabase();
  const repo = createJokiRepository({ database, logger: console });

  await repo.addToQueue("guild-a", { userId: "u1", ticketId: "0001", estimatedSeconds: 60 });
  await repo.addToQueue("guild-b", { userId: "u2", ticketId: "0002", estimatedSeconds: 60 });

  const queueA = await repo.getQueue("guild-a");
  const queueB = await repo.getQueue("guild-b");
  const all = await repo.listQueues();

  assert.equal(queueA.orders.length, 1);
  assert.equal(queueB.orders.length, 1);
  assert.equal(queueA.orders[0].userId, "u1");
  assert.equal(queueB.orders[0].userId, "u2");
  assert.equal(all.length, 2);
});

test("joki automation tick keeps active order until staff marks done", async () => {
  const oldAutoPromote = process.env.JOKI_AUTO_PROMOTE;
  process.env.JOKI_AUTO_PROMOTE = "true";

  const database = createMemoryDatabase();
  const repo = createJokiRepository({ database, logger: console });

  try {
    const first = await repo.addToQueue("guild-auto", {
      userId: "u1",
      ticketId: "0001",
      estimatedSeconds: 1,
    });
    await repo.addToQueue("guild-auto", {
      userId: "u2",
      ticketId: "0002",
      estimatedSeconds: 300,
    });

    await repo.ensureActive("guild-auto");

    const store = await database.read("jokiQueues", {});
    store["guild-auto"].orders[0].status = "processing";
    store["guild-auto"].orders[0].startedAt = new Date(Date.now() - 5_000).toISOString();
    store["guild-auto"].orders[1].status = "queued";
    await database.write("jokiQueues", store);

    const tick = await repo.runAutomationTick("guild-auto");
    const queue = await repo.getQueue("guild-auto");

    assert.equal(tick.completedOrders.length, 0);
    assert.equal(tick.startedOrders.length, 0);
    assert.equal(queue.orders[0].status, "processing");
    assert.equal(queue.orders[0].progress, 99);
    assert.equal(queue.orders[1].status, "queued");

    await repo.setOrderStatus("guild-auto", first.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      progress: 100,
    });

    const nextQueue = await repo.getQueue("guild-auto");
    assert.equal(nextQueue.orders[0].status, "completed");
    assert.equal(nextQueue.orders[1].status, "processing");
  } finally {
    process.env.JOKI_AUTO_PROMOTE = oldAutoPromote;
  }
});
test("joki claim/finish stores staff actor and is not restricted to customer id", async () => {
  const database = createMemoryDatabase();
  const repo = createJokiRepository({ database, logger: console });

  const order = await repo.addToQueue("guild-ops", {
    userId: "customer-1",
    ticketId: "0101",
    estimatedSeconds: 120,
  });

  const claim = await repo.claimOrder("guild-ops", order.id, "staff-1");
  assert.equal(claim.ok, true);

  const afterClaim = await repo.getOrderById("guild-ops", order.id);
  assert.equal(afterClaim.status, "processing");
  assert.equal(afterClaim.claimedBy, "staff-1");
  assert.ok(afterClaim.claimedAt);

  const finish = await repo.completeOrder("guild-ops", order.id, "staff-2");
  assert.equal(finish.ok, true);

  const afterFinish = await repo.getOrderById("guild-ops", order.id);
  assert.equal(afterFinish.status, "completed");
  assert.equal(afterFinish.completedBy, "staff-2");
  assert.ok(afterFinish.completedAt);
});
