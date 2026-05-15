const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestDatabase, createAllRepositories, createFakeGuild, createFakeMember } = require("../business/helpers");
const { createDeliveryService } = require("../../src/services/deliveryService");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

function createFakeTextGuild({ dmShouldSucceed = true, memberId = "cust-1" } = {}) {
    const guild = createFakeGuild();
    const member = {
        id: memberId,
        send: async () => {
            if (!dmShouldSucceed) throw new Error("DM failed");
            return { ok: true };
        },
    };

    // Patch members.fetch for deliveryService DM step
    guild.members.fetch = async () => member;

    return guild;
}

test("feature auto-delivery: paid -> reserve -> DM success => sold; DM fail => available; concurrent delivery only 1 success", async () => {
    const { database } = createTestDatabase("features-auto-delivery");
    const repositories = createAllRepositories(database);

    const stockRepo = repositories.simpleStoreRepository ? null : null; // unused; deliveryService builds its own stockRepo from database

    const guildId = "guild-001";
    const sku = "SKU-DIGI-AD-1";
    const orderId = "HYP-AD-1";
    const userId = "cust-1";
    const ticketId = "TICKET-0001";

    const guild = createFakeGuild();
    guild.id = guildId;

    // Stock setup: item + one available unit
    const deliveryService = createDeliveryService({
        botConfig: {},
        logger: createSilentLogger(),
        database,
        repositories,
        loggingService: { logOrder: async () => { } },
    });

    // create stock item
    const stockRepo2 = require("../../src/repositories/stockRepository").createStockRepository(database);

    const category = await stockRepo2.ensureCategoryForKey(guildId, "SULTAN_AD");
    const item = await stockRepo2.stockItems.create({
        guildId,
        categoryId: category.id,
        sku,
        name: "Paket Sultan AD",
        deliveryType: "auto",
        type: "digital",
    });

    const unit = await stockRepo2.stockUnits.create({
        guildId,
        itemId: item.id,
        valueEncrypted: "VAL-ENC-123456",
        skuSnapshot: sku,
        nameSnapshot: item.name,
        status: "available",
        addedBy: "admin-1",
    });

    // Order setup (deliveryService looks up by ticketId and expects order.sku + order.id + order.userId)
    await database.write("orders", [
        {
            id: orderId,
            guildId,
            ticketId,
            userId,
            sku,
            product: item.name,
            category: "digital",
            status: "paid",
            paymentStatus: "paid",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ]);

    // DM success path
    const guildSuccess = createFakeTextGuild({ dmShouldSucceed: true, memberId: userId });
    guildSuccess.id = guildId;
    const res1 = await deliveryService.tryAutoDeliver(guildSuccess, ticketId);
    assert.equal(res1.ok, true, `autoDeliver should succeed: ${res1?.reason || res1?.message || "unknown"}`);
    const soldUnit = await stockRepo2.stockUnits.findById(unit.id);
    assert.equal(soldUnit.status, "sold");
    assert.equal(soldUnit.soldToOrderId, orderId);

    // DM fail path: reset unit to available for same order
    await stockRepo2.stockUnits.updateById(unit.id, {
        status: "available",
        reservedByOrderId: null,
        reservedAt: null,
        soldToOrderId: null,
        deliveredAt: null,
    });

    const guildFail = createFakeTextGuild({ dmShouldSucceed: false, memberId: userId });
    guildFail.id = guildId;
    const resFail = await deliveryService.tryAutoDeliver(guildFail, ticketId);
    assert.equal(resFail.ok, false);
    const unitAfterFail = await stockRepo2.stockUnits.findById(unit.id);
    assert.equal(unitAfterFail.status, "available", "DM failed should revert unit to available");

    // Concurrent delivery: only one should reserve+send+sell
    // Reset again to available and ensure DM success.
    await stockRepo2.stockUnits.updateById(unit.id, {
        status: "available",
        reservedByOrderId: null,
        reservedAt: null,
        soldToOrderId: null,
        deliveredAt: null,
    });

    const guildConcurrent = createFakeTextGuild({ dmShouldSucceed: true, memberId: userId });
    guildConcurrent.id = guildId;
    const [c1, c2] = await Promise.all([
        deliveryService.tryAutoDeliver(guildConcurrent, ticketId),
        deliveryService.tryAutoDeliver(guildConcurrent, ticketId),
    ]);

    const okCount = [c1, c2].filter((r) => r && r.ok).length;
    assert.equal(okCount, 1, "only one concurrent delivery should succeed");

    const finalUnit = await stockRepo2.stockUnits.findById(unit.id);
    assert.equal(finalUnit.status, "sold");
});
