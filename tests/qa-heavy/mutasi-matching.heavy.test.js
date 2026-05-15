const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../../src/database/connection");
const { createOpsRepository } = require("../../src/repositories/opsRepository");
const { createOrderRepository } = require("../../src/repositories/orderRepository");
const { createPaymentRepository } = require("../../src/repositories/paymentRepository");
const { createBacklogService } = require("../../src/services/backlogService");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-mutasi-"));
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
    return { info() { }, warn() { }, error() { } };
}

test("mutasi matching heavy: multiple pending invoices, same nominals, duplicate mutasi, skip paid", async () => {
    const paths = createTempPaths();
    const logger = createSilentLogger();
    const database = createDatabase(paths, logger);
    database.init();

    const opsRepository = createOpsRepository(database);
    const orderRepository = createOrderRepository(database);
    const paymentRepository = createPaymentRepository(database);

    const backlogService = createBacklogService({
        logger,
        repositories: { opsRepository, orderRepository, paymentRepository },
        loggingService: null,
        statusSyncService: null,
        roleService: null
    });

    const guild = { id: "g-1", channels: { cache: { get: () => null } } };

    // Seed Orders & Payments
    // 1. Pending 50k
    await orderRepository.create({ id: "O-1", guildId: "g-1", status: "waiting", paymentStatus: "unpaid" });
    await paymentRepository.create({ id: "P-1", guildId: "g-1", orderId: "O-1", amount: 50000, status: "pending" });

    // 2. Pending 50k (another one to test exact match doesn't steal)
    await orderRepository.create({ id: "O-2", guildId: "g-1", status: "waiting", paymentStatus: "unpaid" });
    await paymentRepository.create({ id: "P-2", guildId: "g-1", orderId: "O-2", amount: 50000, status: "pending" });

    // 3. Paid 100k
    await orderRepository.create({ id: "O-3", guildId: "g-1", status: "paid", paymentStatus: "paid" });
    await paymentRepository.create({ id: "P-3", guildId: "g-1", orderId: "O-3", amount: 100000, status: "paid" });

    // 4. Pending 75k
    await orderRepository.create({ id: "O-4", guildId: "g-1", status: "waiting", paymentStatus: "unpaid" });
    await paymentRepository.create({ id: "P-4", guildId: "g-1", orderId: "O-4", amount: 75000, status: "pending" });

    // Add Mutasi
    // M1: 50k
    const m1 = await backlogService.addMutationAndMatch({ guild, amount: "50000", reference: "REF-1", method: "qris" });
    assert.equal(m1.match.matched, 1, "Should match 1 pending payment of 50k");

    // M2: 50k duplicate ref -> Should fail
    const m2 = await backlogService.addMutationAndMatch({ guild, amount: "50000", reference: "REF-1", method: "qris" });
    assert.equal(m2.ok, false, "Should fail duplicate reference");

    // M3: 100k -> Should NOT match P-3 because P-3 is already paid
    const m3 = await backlogService.addMutationAndMatch({ guild, amount: "100000", reference: "REF-3", method: "qris" });
    assert.equal(m3.match.matched, 0, "Should not match already paid order");

    // M4: 50k -> Should match the other pending 50k (P-2)
    const m4 = await backlogService.addMutationAndMatch({ guild, amount: "50000", reference: "REF-4", method: "qris" });
    assert.equal(m4.match.matched, 1, "Should match the remaining 50k pending payment");

    // M5: 50k -> No more pending 50k, should just store mutasi
    const m5 = await backlogService.addMutationAndMatch({ guild, amount: "50000", reference: "REF-5", method: "qris" });
    assert.equal(m5.match.matched, 0, "No pending 50k left");

    // Verify final states
    const allPayments = await paymentRepository.getAll();
    const p1 = allPayments.find(p => p.id === "P-1");
    const p2 = allPayments.find(p => p.id === "P-2");
    
    // Either P-1 or P-2 should be paid. Since we added two 50k mutasi, BOTH should be paid.
    assert.equal(p1.status, "paid");
    assert.equal(p2.status, "paid");
});
