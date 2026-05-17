const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createTestDatabase,
    createAllRepositories,
    createFakeGuild,
    createFakeMember,
    createFakeInteraction,
} = require("../business/helpers");

const jokiTomorrowCommand = require("../../src/commands/joki/jokiTomorrow");
const { createJokiService } = require("../../src/services/jokiService");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

test("feature joki-tomorrow: HOLD + remainingHeist > 0 tampil; DONE/remaining=0/cancelled tidak tampil", async () => {
    const { database } = createTestDatabase("features-tomorrow");
    const repositories = createAllRepositories(database);

    const jokiService = createJokiService({
        botConfig: {},
        logger: createSilentLogger(),
        repositories,
    });

    const guild = createFakeGuild();
    const staff = createFakeMember({ userId: "staff-1", roles: ["Staff"] });

    // Seed queue with multiple statuses
    const q = await repositories.jokiRepository.addToQueue(guild.id, {
        userId: staff.user.id,
        orderLabel: "🎮 ENHANCED\nOrderA\nORDER ID: HYP-0201",
        totalHeist: 100,
        completedHeist: 80,
        remainingHeist: 20,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });
    await repositories.jokiRepository.setOrderStatus(guild.id, q.id, { status: "hold", remainingHeist: 20 });

    const qDone = await repositories.jokiRepository.addToQueue(guild.id, {
        userId: staff.user.id,
        orderLabel: "🎮 ENHANCED\nOrderDone\nORDER ID: HYP-0202",
        totalHeist: 100,
        completedHeist: 100,
        remainingHeist: 0,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });
    await repositories.jokiRepository.setOrderStatus(guild.id, qDone.id, { status: "completed", remainingHeist: 0 });

    const qRemainingZeroHold = await repositories.jokiRepository.addToQueue(guild.id, {
        userId: staff.user.id,
        orderLabel: "🎮 ENHANCED\nOrderHoldZero\nORDER ID: HYP-0203",
        totalHeist: 100,
        completedHeist: 100,
        remainingHeist: 0,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });
    await repositories.jokiRepository.setOrderStatus(guild.id, qRemainingZeroHold.id, { status: "hold", remainingHeist: 0 });

    const qCancelled = await repositories.jokiRepository.addToQueue(guild.id, {
        userId: staff.user.id,
        orderLabel: "🎮 ENHANCED\nOrderCancelled\nORDER ID: HYP-0204",
        totalHeist: 100,
        completedHeist: 70,
        remainingHeist: 30,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });
    await repositories.jokiRepository.setOrderStatus(guild.id, qCancelled.id, { status: "cancelled", remainingHeist: 30 });

    // Interaction mock with services container
    const interaction = createFakeInteraction({
        guildId: guild.id,
        userId: staff.user.id,
        roles: ["Staff"],
    });

    const client = {
        container: {
            services: { jokiService },
        },
    };

    await jokiTomorrowCommand.execute(interaction, client);

    // We validate embed content heuristically by extracting description/fields from reply
    const embedValue = String(interaction._lastReply?.embeds?.[0]?.data?.fields?.[0]?.value ?? interaction._lastReplyContent ?? "");

    // Must include only HYP-0201
    assert.match(embedValue, /HYP-0201/i);

    assert.ok(!/HYP-0202/i.test(embedValue), "DONE order must not appear");
    assert.ok(!/HYP-0203/i.test(embedValue), "HOLD with remaining=0 must not appear");
    assert.ok(!/HYP-0204/i.test(embedValue), "cancelled must not appear");

    // Output fields required (minimal): ORDER ID / status / sisa
    assert.ok(/STATUS:/i.test(embedValue), "embed should contain STATUS field");
});
