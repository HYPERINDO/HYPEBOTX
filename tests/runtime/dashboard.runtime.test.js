const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createTestDatabase,
    createAllRepositories,
    createFakeGuild,
    createSilentLogger,
} = require("../business/helpers");

const { createBacklogService } = require("../../src/services/backlogService");

test("runtime: owner dashboard start/health/stop smoke", async () => {
    const { database } = createTestDatabase("runtime-dashboard-smoke");
    const repositories = createAllRepositories(database);
    const logger = createSilentLogger();

    const backlogService = createBacklogService({
        botConfig: {},
        logger,
        repositories,
        loggingService: null,
        statusSyncService: null,
        orderService: null,
        paymentService: null,
    });

    const client = {
        guilds: { cache: new Map() },
        commands: new Map(),
        container: { jobs: {} },
    };

    // avoid port collisions
    process.env.OWNER_DASHBOARD_PORT = "8788";
    process.env.OWNER_DASHBOARD_HOST = "127.0.0.1";

    const { url } = await backlogService.startOwnerDashboardServer(client);
    assert.ok(String(url).includes(":8788"));

    const resp = await fetch(url + "/health.json");
    assert.equal(resp.status, 200);

    const json = await resp.json();
    assert.ok(json && typeof json === "object");
    assert.ok(json.runtime, "health payload should include runtime");

    await backlogService.stopOwnerDashboardServer();
});
