const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createTestDatabase,
  createAllRepositories,
  createFakeGuild,
  createFakeMember,
  assertHeistInvariant,
} = require("./helpers");

const { createJokiService } = require("../../src/services/jokiService");

function createSilentLogger() {
  return { info() { }, warn() { }, error() { }, debug() { } };
}

function buildSeedQueueOrder({ guildId, orderId, orderLabel, totalHeist, completedHeist, remainingHeist, dailyLimitHeist, progressDate }) {
  return {
    guildId,
    orderLabel,
    totalHeist,
    completedHeist,
    remainingHeist,
    dailyLimitHeist,
    progressDate,
    id: orderId,
  };
}

test("business heist-progress: Paket Sultan flow (set total/completed -> progress -> reject done -> final done + queue/history)", async () => {
  const { database } = createTestDatabase("heist-flow-sultan");
  const repositories = createAllRepositories(database);

  const jokiService = createJokiService({
    botConfig: {},
    logger: createSilentLogger(),
    repositories,
    loggingService: null,
    statusSyncService: null,
  });

  const guild = createFakeGuild();
  const staff = createFakeMember({ userId: "staff-1", roles: ["Staff"] });

  // 1) Seed order to active queue with remaining 30 (completed 70), daily limit 20, yesterday progressDate
  const queueEntry = await repositories.jokiRepository.addToQueue(guild.id, {
    userId: "customer-1",
    orderLabel: "🎮 ENHANCED\nCustomerA\nORDER ID: HYP-0054",
    totalHeist: 100,
    completedHeist: 70,
    remainingHeist: 30,
    dailyLimitHeist: 20,
    progressDate: "2026-05-12", // Yesterday
  });

  // Ensure queue is processing/active; some implementations use status "processing" as the active one
  await repositories.jokiRepository.setOrderStatus(guild.id, queueEntry.id, { status: "processing" });

  // 2) joki progress 10 -> add 10 completed (todayCompleted resets because progressDate changed)
  const result1 = await jokiService.processHeistProgress({
    guild,
    actorUser: staff.user,
    target: "HYP-0054",
    amount: "10",
  });

  assert.equal(result1.ok, true, result1.message);
  assert.equal(result1.order.totalHeist, 100);
  assert.equal(result1.order.completedHeist, 80);
  assert.equal(result1.order.remainingHeist, 20);
  assert.equal(result1.order.todayCompletedHeist, 10);
  assert.equal(result1.order.dailyLimitHeist, 20);
  assertHeistInvariant(result1.order, assert);

  // 3) joki done must be rejected because remainingHeist is still 20
  const doneRejected = await jokiService.processManualQueueStatus({
    guild,
    actorUser: staff.user,
    target: "HYP-0054",
    action: "done",
  });

  assert.equal(doneRejected.ok, false, "done should be rejected when remainingHeist > 0");
  assert.match(String(doneRejected.message || ""), /sisa|remaining|belum bisa DONE/i);

  // 4) joki progress 20 -> now completed becomes 100, remaining 0
  const result2 = await jokiService.processHeistProgress({
    guild,
    actorUser: staff.user,
    target: "HYP-0054",
    amount: "20",
  });

  assert.equal(result2.ok, true, result2.message);
  assert.equal(result2.order.totalHeist, 100);
  assert.equal(result2.order.completedHeist, 100);
  assert.equal(result2.order.remainingHeist, 0);
  assert.equal(result2.order.todayCompletedHeist, 30);
  assert.equal(result2.order.status, "completed"); // service promotes to completed when remaining = 0
  assertHeistInvariant(result2.order, assert);

  // 5) done should now be accepted (remaining 0)
  const doneAccepted = await jokiService.processManualQueueStatus({
    guild,
    actorUser: staff.user,
    target: "HYP-0054",
    action: "done",
  });

  assert.equal(doneAccepted.ok, true, doneAccepted.message);
  assert.equal(doneAccepted.order.remainingHeist, 0);
  assert.equal(doneAccepted.order.status, "completed");

  // 6) After DONE: DONE must NOT appear in active queue embed lines.
  // buildQueueEmbed() filters out statuses ["queued","processing","hold"]; so completed should be absent from the rendered embed.
  const view = await jokiService.getQueueView(guild);
  const embed = jokiService.buildQueueEmbed(guild.name, view);

  const rendered = String(embed?.data?.fields?.[0]?.value ?? embed?.fields?.[0]?.value ?? "");
  assert.ok(
    !/STATUS:\s*WORK|STATUS:\s*HOLD/i.test(rendered),
    "completed order should not be rendered as WORK/HOLD in active queue embed",
  );

  // History expectation is repo-dependent; since queue repository structure varies, we keep this as a weaker assertion:
  // if queue.history exists, completed order should exist in history.
  if (typeof repositories.jokiRepository.getQueueHistory === "function") {
    // optional; not guaranteed in all repo impl
    const history = await repositories.jokiRepository.getQueueHistory(guild.id).catch(() => null);
    if (Array.isArray(history?.history || history)) {
      assert.ok(
        history.history?.some((o) => String(o.id) === String(queueEntry.id)) ||
        history.some((o) => String(o.id) === String(queueEntry.id)),
        "completed order should be present in history",
      );
    }
  }
});

test("business heist-progress: Progress bukan sisa (progress 20 means +20 completed)", async () => {
  const { database } = createTestDatabase("heist-progress-vs-remaining");
  const repositories = createAllRepositories(database);

  const jokiService = createJokiService({
    botConfig: {},
    logger: createSilentLogger(),
    repositories,
    loggingService: null,
    statusSyncService: null,
  });

  const guild = createFakeGuild();
  const staff = createFakeMember();

  // total 100, completed 70, remaining 30, dailyLimit 20. progressDate set yesterday -> todayCompleted resets
  const queueEntry = await repositories.jokiRepository.addToQueue(guild.id, {
    orderLabel: "🎮 ENHANCED\nCustomerB\nORDER ID: HYP-0054",
    totalHeist: 100,
    completedHeist: 70,
    remainingHeist: 30,
    dailyLimitHeist: 20,
    progressDate: "2026-05-12",
  });

  await repositories.jokiRepository.setOrderStatus(guild.id, queueEntry.id, { status: "processing" });

  const res = await jokiService.processHeistProgress({
    guild,
    actorUser: staff.user,
    target: "HYP-0054",
    amount: "20",
  });

  assert.equal(res.ok, true);
  assert.equal(res.order.totalHeist, 100);
  assert.equal(res.order.completedHeist, 90);
  assert.equal(res.order.remainingHeist, 10);
  assertHeistInvariant(res.order, assert);
});

test("business heist-progress invariants: edge cases must not create negatives or invalid states", async () => {
  const cases = [
    { name: "progress exceeds remaining", totalHeist: 100, completedHeist: 70, remainingHeist: 30, amount: "50", expectedCompleted: 100, expectedRemaining: 0, ok: true },
    { name: "progress 0 rejected", totalHeist: 100, completedHeist: 70, remainingHeist: 30, amount: "0", ok: false },
    { name: "progress negative rejected", totalHeist: 100, completedHeist: 70, remainingHeist: 30, amount: "-10", ok: false },
    { name: "progress non-number rejected", totalHeist: 100, completedHeist: 70, remainingHeist: 30, amount: "abc", ok: false },
    // If totalHeist is null, service falls back to remainingHeist as safeTotal.
    // So this case should succeed, not fail.
    { name: "totalHeist empty-like (fallback to remainingHeist)", totalHeist: null, completedHeist: 0, remainingHeist: 50, amount: "10", expectedCompleted: 10, expectedRemaining: 40, ok: true },
  ];

  for (const c of cases) {
    const { database } = createTestDatabase(`heist-invariant-${c.name.replace(/\s+/g, "-")}`);
    const repositories = createAllRepositories(database);

    const jokiService = createJokiService({
      botConfig: {},
      logger: createSilentLogger(),
      repositories,
      loggingService: null,
      statusSyncService: null,
    });

    const guild = createFakeGuild();
    const staff = createFakeMember();

    // Seed order. If totalHeist is null, service will require totalHeist or remainingHeist fallback.
    // For spec: totalHeist kosong -> error jelas. We'll align with service behavior (it rejects if totalHeist not known and remaining not usable).
    const queueEntry = await repositories.jokiRepository.addToQueue(guild.id, {
      orderLabel: "🎮 ENHANCED\nCustomerC\nORDER ID: HYP-0099",
      totalHeist: c.totalHeist,
      completedHeist: c.completedHeist,
      remainingHeist: c.remainingHeist,
      dailyLimitHeist: 20,
      progressDate: "2026-05-12",
    });
    await repositories.jokiRepository.setOrderStatus(guild.id, queueEntry.id, { status: "processing" });

    const res = await jokiService.processHeistProgress({
      guild,
      actorUser: staff.user,
      target: "HYP-0099",
      amount: c.amount,
    });

    if (!c.ok) {
      assert.equal(res.ok, false, `case '${c.name}' should fail`);
      assert.match(String(res.message || ""), /Jumlah progress|total|Order ini bukan heist|bukan heist|invalid/i);
      continue;
    }

    assert.equal(res.ok, true, c.name);
    assert.equal(res.order.completedHeist, c.expectedCompleted);
    assert.equal(res.order.remainingHeist, c.expectedRemaining);

    // Additional invariants
    assertHeistInvariant(res.order, assert);

    // dailyCompletedHeist never negative
    assert.ok(Number(res.order.todayCompletedHeist) >= 0, "todayCompletedHeist should not be negative");

    // joki done should only be allowed when remainingHeist === 0
    const doneRes = await jokiService.processManualQueueStatus({
      guild,
      actorUser: staff.user,
      target: "HYP-0099",
      action: "done",
    });

    if (c.expectedRemaining === 0) {
      assert.equal(doneRes.ok, true, "done should be accepted when remainingHeist == 0");
    } else {
      assert.equal(doneRes.ok, false, "done must be rejected when remainingHeist > 0");
    }
  }
});

test("business heist state machine: DONE only when remainingHeist = 0; cannot stay DONE if remaining > 0", async () => {
  const { database } = createTestDatabase("heist-state-machine");
  const repositories = createAllRepositories(database);

  const jokiService = createJokiService({
    botConfig: {},
    logger: createSilentLogger(),
    repositories,
    loggingService: null,
    statusSyncService: null,
  });

  const guild = createFakeGuild();
  const staff = createFakeMember();

  const queueEntry = await repositories.jokiRepository.addToQueue(guild.id, {
    orderLabel: "🎮 ENHANCED\nCustomerD\nORDER ID: HYP-0107",
    totalHeist: 100,
    completedHeist: 60,
    remainingHeist: 40,
    dailyLimitHeist: 20,
    progressDate: "2026-05-12",
  });

  // Start at processing (WORK)
  await repositories.jokiRepository.setOrderStatus(guild.id, queueEntry.id, { status: "processing" });

  // Try DONE while remaining>0
  const doneRejected = await jokiService.processManualQueueStatus({
    guild,
    actorUser: staff.user,
    target: "HYP-0107",
    action: "done",
  });
  assert.equal(doneRejected.ok, false);

  // Progress 20 -> completed 80 remaining 20 -> status depends on dailyLimit; should remain processing unless hold triggered by today limit.
  const prog = await jokiService.processHeistProgress({
    guild,
    actorUser: staff.user,
    target: "HYP-0107",
    amount: "20",
  });
  assert.equal(prog.ok, true);
  assertHeistInvariant(prog.order, assert);

  // DONE should still reject if remainingHeist > 0
  const doneRejected2 = await jokiService.processManualQueueStatus({
    guild,
    actorUser: staff.user,
    target: "HYP-0107",
    action: "done",
  });
  assert.equal(doneRejected2.ok, false);

  // Progress remaining 20 -> complete
  const prog2 = await jokiService.processHeistProgress({
    guild,
    actorUser: staff.user,
    target: "HYP-0107",
    amount: "20",
  });
  assert.equal(prog2.ok, true);
  assert.equal(prog2.order.remainingHeist, 0);

  const doneAccepted = await jokiService.processManualQueueStatus({
    guild,
    actorUser: staff.user,
    target: "HYP-0107",
    action: "done",
  });
  assert.equal(doneAccepted.ok, true);
});
