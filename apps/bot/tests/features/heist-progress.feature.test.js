const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createTestDatabase,
    createAllRepositories,
    createFakeGuild,
    createFakeMember,
    assertHeistInvariant,
} = require("../business/helpers");

const { createJokiService } = require("../../src/services/jokiService");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

test("feature heist-progress: Paket Sultan; progress vs remaining; done gating; invariants", async () => {
    const { database } = createTestDatabase("features-heist-progress");
    const repositories = createAllRepositories(database);

    const jokiService = createJokiService({
        botConfig: {},
        logger: createSilentLogger(),
        repositories,
    });

    const guild = createFakeGuild();
    const staff = createFakeMember({ userId: "staff-1", roles: ["Staff"] });

    // Paket Sultan = 100 HEIST
    // Kemarin sisa 30 => completed 70
    const queueEntry = await repositories.jokiRepository.addToQueue(guild.id, {
        userId: "customer-1",
        orderLabel: "🎮 ENHANCED\nCustomerSultan\nORDER ID: HYP-0054",
        totalHeist: 100,
        completedHeist: 70,
        remainingHeist: 30,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12", // yesterday
    });

    await repositories.jokiRepository.setOrderStatus(guild.id, queueEntry.id, { status: "processing" });

    // progress tidak boleh negatif / progress 0 ditolak / progress bukan angka ditolak
    {
        const resNeg = await jokiService.processHeistProgress({
            guild,
            actorUser: staff.user,
            target: "HYP-0054",
            amount: "-10",
        });
        assert.equal(resNeg.ok, false);
    }

    {
        const resZero = await jokiService.processHeistProgress({
            guild,
            actorUser: staff.user,
            target: "HYP-0054",
            amount: "0",
        });
        assert.equal(resZero.ok, false);
    }

    {
        const resNaN = await jokiService.processHeistProgress({
            guild,
            actorUser: staff.user,
            target: "HYP-0054",
            amount: "abc",
        });
        assert.equal(resNaN.ok, false);
    }

    // progress melebihi sisa harus clamp
    {
        const resClamp = await jokiService.processHeistProgress({
            guild,
            actorUser: staff.user,
            target: "HYP-0054",
            amount: "999",
        });
        assert.equal(resClamp.ok, true);
        assert.equal(resClamp.order.remainingHeist, 0);
        assert.equal(resClamp.order.completedHeist, 100);
        assertHeistInvariant(resClamp.order, assert);
    }

    // Reset fresh order for main happy-path assertions (so clamp doesn't pollute)
    const { database: database2 } = createTestDatabase("features-heist-progress-happy");
    const repositories2 = createAllRepositories(database2);
    const jokiService2 = createJokiService({ botConfig: {}, logger: createSilentLogger(), repositories: repositories2 });
    const guild2 = createFakeGuild();
    const staff2 = createFakeMember({ userId: "staff-1", roles: ["Staff"] });

    const queueEntry2 = await repositories2.jokiRepository.addToQueue(guild2.id, {
        userId: "customer-1",
        orderLabel: "🎮 ENHANCED\nCustomerSultan\nORDER ID: HYP-0054",
        totalHeist: 100,
        completedHeist: 70,
        remainingHeist: 30,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });
    await repositories2.jokiRepository.setOrderStatus(guild2.id, queueEntry2.id, { status: "processing" });

    // Kemarin sisa 30, hari ini progress 10 => completed +10 = 80, remaining 20
    // (todayCompleted resets because progressDate stale)
    const res1 = await jokiService2.processHeistProgress({
        guild: guild2,
        actorUser: staff2.user,
        target: "HYP-0054",
        amount: "10",
    });

    assert.equal(res1.ok, true);
    assert.equal(res1.order.totalHeist, 100);
    assert.equal(res1.order.completedHeist, 80);
    assert.equal(res1.order.remainingHeist, 20);
    assert.equal(res1.order.todayCompletedHeist, 10);
    assertHeistInvariant(res1.order, assert);

    // joki done ditolak kalau remainingHeist > 0
    const doneRejected = await jokiService2.processManualQueueStatus({
        guild: guild2,
        actorUser: staff2.user,
        target: "HYP-0054",
        action: "done",
    });
    assert.equal(doneRejected.ok, false);
    assert.match(String(doneRejected.message || ""), /sisa|remaining|DONE/i);

    // joki progress 20 bukan berarti sisa 20; itu adalah tambah completed 20 => completed 100, remaining 0
    const res2 = await jokiService2.processHeistProgress({
        guild: guild2,
        actorUser: staff2.user,
        target: "HYP-0054",
        amount: "20",
    });
    assert.equal(res2.ok, true);
    assert.equal(res2.order.completedHeist, 100);
    assert.equal(res2.order.remainingHeist, 0);
    assertHeistInvariant(res2.order, assert);

    // joki done diterima kalau remainingHeist = 0
    const doneAccepted = await jokiService2.processManualQueueStatus({
        guild: guild2,
        actorUser: staff2.user,
        target: "HYP-0054",
        action: "done",
    });
    assert.equal(doneAccepted.ok, true);
    assert.equal(doneAccepted.order.remainingHeist, 0);
    assert.equal(doneAccepted.order.status, "completed");
});

test("feature heist-progress: Invariant completed+remaining=total; clamp; no negatives", async () => {
    const { database } = createTestDatabase("features-heist-invariant");
    const repositories = createAllRepositories(database);
    const jokiService = createJokiService({ botConfig: {}, logger: createSilentLogger(), repositories });

    const guild = createFakeGuild();
    const staff = createFakeMember({ userId: "staff-1", roles: ["Staff"] });

    const queueEntry = await repositories.jokiRepository.addToQueue(guild.id, {
        userId: "customer-1",
        orderLabel: "🎮 ENHANCED\nCustomerInv\nORDER ID: HYP-0099",
        totalHeist: 100,
        completedHeist: 100,
        remainingHeist: 0,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });

    await repositories.jokiRepository.setOrderStatus(guild.id, queueEntry.id, { status: "processing" });

    // progress 0 -> reject
    const resZero = await jokiService.processHeistProgress({
        guild,
        actorUser: staff.user,
        target: "HYP-0099",
        amount: "0",
    });
    assert.equal(resZero.ok, false);

    // done allowed when remaining=0
    const doneOk = await jokiService.processManualQueueStatus({
        guild,
        actorUser: staff.user,
        target: "HYP-0099",
        action: "done",
    });
    assert.equal(doneOk.ok, true);
    assertHeistInvariant(doneOk.order, assert);
});
