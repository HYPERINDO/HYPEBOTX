const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../../src/database/connection");
const { createOrderRepository } = require("../../src/repositories/orderRepository");
const { createRefundDisputeRepository } = require("../../src/repositories/refundDisputeRepository");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-refund-"));
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

test("refund / dispute heavy: state transition, reasons, link to order", async () => {
    const paths = createTempPaths();
    const database = createDatabase(paths, { info() {}, warn() {}, error() {} });
    database.init();

    const orderRepository = createOrderRepository(database);
    const rdRepository = createRefundDisputeRepository(database);

    const guildId = "g-1";
    await orderRepository.create({ id: "O-1", guildId, status: "paid", userId: "u-1" });

    // 1. Create Refund
    const refund = await rdRepository.create({
        id: "R-1", guildId, orderId: "O-1", amount: 50000, reason: "Barang kosong", customerUserId: "a-1", type: "refund", status: "pending"
    });
    
    assert.equal(refund.orderId, "O-1");
    assert.equal(refund.status, "pending");

    // 2. Resolve Refund
    const resolved = await rdRepository.updateById(refund.id, {
        status: "completed", note: "Dana dikembalikan via BCA"
    });
    
    assert.equal(resolved.status, "completed");
    assert.equal(resolved.note, "Dana dikembalikan via BCA");

    // 3. Create Dispute
    const dispute = await rdRepository.create({
        id: "D-1", guildId, orderId: "O-1", reason: "Akun kena hackback", customerUserId: "u-1", type: "dispute", status: "open"
    });
    
    assert.equal(dispute.status, "open");
    assert.equal(dispute.orderId, "O-1");

    // 4. Resolve Dispute
    const resolvedDispute = await rdRepository.updateById(dispute.id, {
        status: "resolved", note: "Diganti akun baru"
    });
    
    assert.equal(resolvedDispute.status, "resolved");
});
