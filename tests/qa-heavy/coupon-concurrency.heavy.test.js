const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../../src/database/connection");
const { createOpsRepository } = require("../../src/repositories/opsRepository");
const { createOrderRepository } = require("../../src/repositories/orderRepository");
const { createTicketRepository } = require("../../src/repositories/ticketRepository");
const { createBacklogService } = require("../../src/services/backlogService");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-coupon-"));
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

function createSilentLogger() {
    return {
        info() { },
        warn() { },
        error() { },
    };
}

test("coupon concurrency heavy: multiple claims, expired, usage limits, percentage/nominal, no minus", async () => {
    const paths = createTempPaths();
    const logger = createSilentLogger();
    const database = createDatabase(paths, logger);
    database.init();

    const opsRepository = createOpsRepository(database);
    const orderRepository = createOrderRepository(database);
    const ticketRepository = createTicketRepository(database);

    const backlogService = createBacklogService({
        logger,
        repositories: { opsRepository, orderRepository, ticketRepository },
        loggingService: null,
        statusSyncService: null,
        roleService: null
    });

    const guildId = "g-1";
    
    // Seed Coupons
    await backlogService.createCoupon({ guildId, code: "PERCENT10", discountType: "percentage", discountValue: 10, maxRedemptions: 2, createdBy: "admin" });
    await backlogService.createCoupon({ guildId, code: "NOMINAL50K", discountType: "amount", discountValue: 50000, maxRedemptions: 1, createdBy: "admin" });
    
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    await backlogService.createCoupon({ guildId, code: "EXPIRED", discountType: "amount", discountValue: 10000, maxRedemptions: 10, expiresAt: expiredDate.toISOString(), createdBy: "admin" });

    // Seed Orders
    await orderRepository.create({ id: "O-1", guildId, ticketId: "T-1", userId: "u-1", price: "100000" });
    await orderRepository.create({ id: "O-2", guildId, ticketId: "T-2", userId: "u-2", price: "20000" }); // small price to test minus
    await orderRepository.create({ id: "O-3", guildId, ticketId: "T-3", userId: "u-3", price: "100000" });
    await orderRepository.create({ id: "O-4", guildId, ticketId: "T-4", userId: "u-4", price: "100000" });

    // 1. Expired Coupon
    const expResult = await backlogService.redeemCoupon({ guildId, userId: "u-1", orderId: "O-1", code: "EXPIRED" });
    assert.equal(expResult.ok, false);
    assert.match(expResult.message, /expired/i);

    // 2. Nominal - limit 1, no minus
    const nomResult1 = await backlogService.redeemCoupon({ guildId, userId: "u-2", orderId: "O-2", code: "NOMINAL50K" });
    assert.equal(nomResult1.ok, true);
    assert.equal(nomResult1.redemption.discountAmount, 20000); // capped at price 20000

    // Nominal Usage Limit - already used by u-2
    const nomResult2 = await backlogService.redeemCoupon({ guildId, userId: "u-1", orderId: "O-1", code: "NOMINAL50K" });
    assert.equal(nomResult2.ok, false);
    assert.match(nomResult2.message, /limit/i);

    // 3. Percentage Concurrency - max 2 redemptions
    // Promise.all to simulate concurrent claims
    const [p1, p2, p3] = await Promise.all([
        backlogService.redeemCoupon({ guildId, userId: "u-1", orderId: "O-1", code: "PERCENT10" }),
        backlogService.redeemCoupon({ guildId, userId: "u-3", orderId: "O-3", code: "PERCENT10" }),
        backlogService.redeemCoupon({ guildId, userId: "u-4", orderId: "O-4", code: "PERCENT10" })
    ]);

    const successes = [p1, p2, p3].filter(r => r.ok);
    const failures = [p1, p2, p3].filter(r => !r.ok);

    // Exactly 2 should succeed, 1 should fail because of race condition handled correctly?
    // Wait, since we are using atomic write in database, `opsRepository.coupons.updateById` might just override the other one unless we have lock.
    // OpsRepository listRepo does: `const rows = await readRows(); ... rows[index] = {...} ... await writeRows(rows);`
    // Without lock, it might have race condition! So let's see if our DB uses atomic write + memory lock. Yes, `database/connection.js` has a memory lock queue!
    assert.equal(successes.length, 2, "only 2 should succeed due to limit");
    assert.equal(failures.length, 1, "1 should fail due to limit");
    assert.equal(successes[0].redemption.discountAmount, 10000); // 10% of 100k
});
