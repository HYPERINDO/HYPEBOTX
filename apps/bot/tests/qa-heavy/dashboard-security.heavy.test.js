const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { createBacklogService } = require("../../src/services/backlogService");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { } };
}

async function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address ? address.port : null;
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (!port) {
                    reject(new Error("Unable to allocate dashboard test port"));
                    return;
                }
                resolve(port);
            });
        });
    });
}

test("dashboard security heavy: start/status/stop, double start, double stop", async () => {
    const oldPort = process.env.OWNER_DASHBOARD_PORT;
    const oldHost = process.env.OWNER_DASHBOARD_HOST;
    const dynamicPort = await getFreePort();
    process.env.OWNER_DASHBOARD_PORT = String(dynamicPort);
    process.env.OWNER_DASHBOARD_HOST = "127.0.0.1";

    const logger = createSilentLogger();
    const backlogService = createBacklogService({
        logger,
        repositories: {},
        loggingService: null,
        statusSyncService: null,
        roleService: null
    });

    const mockClient = { guilds: { cache: { size: 1 } }, ws: { ping: 50 } };

    try {
        // 1. Initially stopped
        assert.equal(backlogService.getDashboardUrl(), null);

        // 2. Start
        const result1 = await backlogService.startOwnerDashboardServer(mockClient);
        assert.ok(result1.url);
        assert.match(result1.url, /http:\/\//);
        const activeUrl = backlogService.getDashboardUrl();
        assert.equal(activeUrl, result1.url);

        // 3. Double start -> service should return same URL without crashing
        const result2 = await backlogService.startOwnerDashboardServer(mockClient);
        assert.equal(result2.url, activeUrl);

        // 4. Stop
        await backlogService.stopOwnerDashboardServer();
        assert.equal(backlogService.getDashboardUrl(), null);

        // 5. Double stop -> should not crash
        await backlogService.stopOwnerDashboardServer();
        assert.equal(backlogService.getDashboardUrl(), null);
    } finally {
        await backlogService.stopOwnerDashboardServer().catch(() => { });
        if (oldPort === undefined) {
            delete process.env.OWNER_DASHBOARD_PORT;
        } else {
            process.env.OWNER_DASHBOARD_PORT = oldPort;
        }
        if (oldHost === undefined) {
            delete process.env.OWNER_DASHBOARD_HOST;
        } else {
            process.env.OWNER_DASHBOARD_HOST = oldHost;
        }
    }
});
