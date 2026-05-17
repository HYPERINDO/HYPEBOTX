const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createTestDatabase,
    createAllRepositories,
    createFakeGuild,
    createFakeMember,
    assertHeistInvariant,
    assertNotInActiveQueue,
    assertInHistory,
} = require("../business/helpers");

const { createJokiService } = require("../../src/services/jokiService");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

test("feature joki-queue: QUEUE -> WORK -> HOLD -> WORK -> DONE; DONE tidak tampil di active queue", async () => {
    const { database } = createTestDatabase("features-queue-state");
    const repositories = createAllRepositories(database);
    const jokiService = createJokiService({ botConfig: {}, logger: createSilentLogger(), repositories });

    const guild = createFakeGuild();
    const staff = createFakeMember({ userId: "staff-1", roles: ["Staff"] });

    // Seed as QUEUE
    const order = await repositories.jokiRepository.addToQueue(guild.id, {
        userId: "customer-1",
        orderLabel: "🎮 ENHANCED\nUserA\nORDER ID: 1001",
        totalHeist: 10,
        completedHeist: 0,
        remainingHeist: 10,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12", // Yesterday -> todayCompleted resets when progress called
    });

    assert.equal(order.status, "queued");

    // QUEUE -> WORK
    const resWork = await jokiService.processManualQueueStatus({
        guild,
        actorUser: staff.user,
        target: "1001",
        action: "work",
    });
    assert.equal(resWork.ok, true);
    assert.equal(resWork.order.status, "processing");

    // WORK -> HOLD
    const resHold = await jokiService.processManualQueueStatus({
        guild,
        actorUser: staff.user,
        target: "1001",
        action: "hold",
    });
    assert.equal(resHold.ok, true);
    assert.equal(resHold.order.status, "hold");

    // HOLD tetap tampil di active queue list (queued/processing/hold)
    const queueView = await jokiService.getQueueView(guild);
    const foundInActive = (queueView.entries || []).find((o) => o.id === order.id);
    assert.ok(foundInActive, "Order should be in active queue while HOLD");
    assert.ok(["hold", "queued", "processing"].includes(foundInActive.status), "status should be active-state");

    // HOLD -> WORK
    const resWork2 = await jokiService.processManualQueueStatus({
        guild,
        actorUser: staff.user,
        target: "1001",
        action: "work",
    });
    assert.equal(resWork2.ok, true);

    // WORK -> DONE via heist progress until remaining=0
    const resProg = await jokiService.processHeistProgress({
        guild,
        actorUser: staff.user,
        target: "1001",
        amount: "10",
    });
    assert.equal(resProg.ok, true);
    assert.equal(resProg.order.remainingHeist, 0);
    assertHeistInvariant(resProg.order, assert);

    // optional tick (depends on repository impl); safe attempt
    if (typeof repositories.jokiRepository.runAutomationTick === "function") {
        await repositories.jokiRepository.runAutomationTick(guild.id);
    }

    // DONE tidak tampil di active queue embed/render (queue view should not include completed for business expectations)
    const activeQ = await repositories.jokiRepository.getQueue(guild.id);
    assertNotInActiveQueue(activeQ, order.id, assert);

    // DONE masuk history
    assertInHistory(activeQ, order.id, assert);
});

test("feature joki-queue: DONE tidak boleh balik ke WORK tanpa admin recovery (basic guard)", async () => {
    const { database } = createTestDatabase("features-queue-done-guard");
    const repositories = createAllRepositories(database);
    const jokiService = createJokiService({ botConfig: {}, logger: createSilentLogger(), repositories });

    const guild = createFakeGuild();
    const staff = createFakeMember({ userId: "staff-1", roles: ["Staff"] });

    const order = await repositories.jokiRepository.addToQueue(guild.id, {
        userId: "customer-1",
        orderLabel: "🎮 ENHANCED\nUserB\nORDER ID: 1002",
        totalHeist: 5,
        completedHeist: 0,
        remainingHeist: 5,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });

    await repositories.jokiRepository.setOrderStatus(guild.id, order.id, { status: "processing" });

    // Complete to remaining=0
    const resProg = await jokiService.processHeistProgress({
        guild,
        actorUser: staff.user,
        target: "1002",
        amount: "5",
    });
    assert.equal(resProg.ok, true);
    assert.equal(resProg.order.remainingHeist, 0);

    // Attempt manual work should not apply if order is completed (depends on repository constraints).
    // We'll check that status stays completed.
    const resWork = await jokiService.processManualQueueStatus({
        guild,
        actorUser: staff.user,
        target: "1002",
        action: "work",
    });

    // If it returns ok, ensure status is still completed; if it returns not ok, that's acceptable.
    if (resWork.ok) {
        assert.equal(resWork.order.status, "completed");
    } else {
        assert.match(String(resWork.message || ""), /completed|done|tidak|invalid/i);
    }
});
