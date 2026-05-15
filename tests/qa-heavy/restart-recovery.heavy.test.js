const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../../src/database/connection");
const { createStockRepository } = require("../../src/repositories/stockRepository");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-restart-"));
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

test("restart recovery heavy: data persistence across restarts", async () => {
    const paths = createTempPaths();
    
    // Simulate Run 1
    {
        const database = createDatabase(paths, { info() {}, warn() {}, error() {} });
        database.init();

        const stockRepository = createStockRepository(database);
        const item = await stockRepository.stockItems.create({
            id: "I-1", guildId: "G-1", sku: "SKU1", name: "Test Item"
        });
        
        await stockRepository.stockUnits.create({
            id: "U-1", guildId: "G-1", itemId: item.id, status: "reserved", reservedByOrderId: "O-1"
        });
        
        await new Promise(r => setTimeout(r, 100)); // allow flush
    }

    // Simulate Run 2 (Restart)
    {
        const database = createDatabase(paths, { info() {}, warn() {}, error() {} });
        database.init();

        const stockRepository = createStockRepository(database);
        
        // Data should persist
        const items = await stockRepository.stockItems.getAll("G-1");
        assert.equal(items.length, 1);
        assert.equal(items[0].sku, "SKU1");
        
        const units = await stockRepository.stockUnits.getAll("G-1");
        assert.equal(units.length, 1);
        assert.equal(units[0].status, "reserved");
        assert.equal(units[0].reservedByOrderId, "O-1");
    }
});
