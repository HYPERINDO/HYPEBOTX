const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../../src/database/connection");
const { createJokiRepository } = require("../../src/repositories/jokiRepository");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-jokihistory-"));
    return {
        root,
        storage: {
            root: path.join(root, "storage"),
            backups: path.join(root, "storage", "backups"),
            transcripts: path.join(root, "storage", "transcripts"),
            temp: path.join(root, "storage", "temp"),
        },
    };
}

test("joki history heavy: queue lifecycle, hold reminder, done history", async () => {
    const paths = createTempPaths();
    const database = createDatabase(paths, { info() {}, warn() {}, error() {} });
    database.init();

    const jokiRepository = createJokiRepository(database);
    const guildId = "g-1";

    await jokiRepository.ensureQueue(guildId);
    
    // 1. Add to queue
    const order1 = await jokiRepository.addToQueue(guildId, {
        userId: "u-1", ticketId: "T-1", estimatedSeconds: 3600, orderLabel: "Test Order"
    });
    
    // 2. Start
    await jokiRepository.claimOrder(guildId, order1.id, "staff-1");
    
    // 3. Complete
    await jokiRepository.completeOrder(guildId, order1.id, "staff-1");
    
    // 4. Tick automation to clear done orders from active queue and push to history
    const tick = await jokiRepository.runAutomationTick(guildId);
    assert.equal(tick.completedOrders.length, 1, "Should archive 1 completed order");
    
    // 5. Verify queue
    const queue = await jokiRepository.getQueue(guildId);
    assert.equal(queue.orders.length, 0, "Active queue should be empty");
    
    // 6. Verify history
    const history = await jokiRepository.getHistory(guildId);
    assert.equal(history.length, 1, "Should have 1 history record");
    assert.equal(history[0].id, order1.id);
    
    // 7. Add hold order
    const order2 = await jokiRepository.addToQueue(guildId, {
        userId: "u-2", ticketId: "T-2", estimatedSeconds: 3600, orderLabel: "Hold Order"
    });
    await jokiRepository.setOrderStatus(guildId, order2.id, { status: "hold" });
    
    // Tick should NOT clear hold order
    const tick2 = await jokiRepository.runAutomationTick(guildId);
    assert.equal(tick2.completedOrders.length, 0);
    
    const queue2 = await jokiRepository.getQueue(guildId);
    assert.equal(queue2.orders.length, 1, "Hold order should stay in active queue");
});
