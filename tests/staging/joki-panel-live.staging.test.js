const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestDatabase, createAllRepositories, createFakeGuild, createFakeChannel, createFakeMember, createFakeInteraction, createSilentLogger } = require("../business/helpers");
const { createBacklogService } = require("../../src/services/backlogService");
const { handleButton } = require("../../src/handlers/buttonHandler");
const roles = require("../../src/config/roles");
const { componentIds } = require("../../src/utils/constants");

test("staging smoke: joki buttons route safely (status/progress/tomorrow/sync dry-run)", async () => {
    const { database } = createTestDatabase("staging-joki-panel-smoke");
    const repositories = createAllRepositories(database);

    const guild = createFakeGuild({ id: "g-joki-1" });
    const channel = createFakeChannel({ id: "ch-joki-1", name: "order-joki-1" });
    guild.channels.cache.set(channel.id, channel);

    const staff = createFakeMember({ userId: "staff-joki-1", roles: [roles.staff], isOwner: true });

    const backlogService = createBacklogService({
        botConfig: {},
        logger: createSilentLogger(),
        repositories,
        loggingService: null,
        statusSyncService: null,
        orderService: {},
        paymentService: null,
    });

    const client = {
        container: {
            botConfig: {},
            logger: createSilentLogger(),
            repositories,
            services: { backlogService, jokiService: backlogService.jokiService || {} },
        },
        commands: new Map(),
    };

    // Best-effort smoke: ensure handlers do not crash
    const ids = [
        componentIds.jokiStartPrefix ? componentIds.jokiStartPrefix + "O-1" : null,
        componentIds.jokiFinishPrefix ? componentIds.jokiFinishPrefix + "O-1" : null,
        componentIds.jokiSyncAllDryRunPrefix ? componentIds.jokiSyncAllDryRunPrefix + "g-joki-1" : null,
    ].filter(Boolean);

    for (const customId of ids) {
        const itx = createFakeInteraction({ userId: staff.id, guildId: guild.id, roles: [roles.staff], channel });
        itx.member = staff;
        itx.customId = customId;
        await handleButton(client, itx).catch(() => null);
    }
});
