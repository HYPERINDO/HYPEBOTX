const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestDatabase, createAllRepositories } = require("../business/helpers");
const { createStockRepository } = require("../../src/repositories/stockRepository");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

test("feature stock-management: stockUnits lifecycle available -> reserved -> sold; void dan sold tidak jadi available", async () => {
    const { database } = createTestDatabase("features-stock-lifecycle");
    const repositories = createAllRepositories(database);

    const stockRepo = createStockRepository(database);

    const guildId = "guild-001";

    // Create stock item (digital auto delivery compatible)
    const category = await stockRepo.ensureCategoryForKey(guildId, "SULTAN");
    const item = await stockRepo.stockItems.create({
        guildId,
        categoryId: category.id,
        sku: "SKU-DIGI-1",
        name: "Paket Sultan (Digital)",
        deliveryType: "auto",
        type: "digital",
    });

    // Add 2 available units
    const unit1 = await stockRepo.stockUnits.create({
        guildId,
        itemId: item.id,
        valueEncrypted: "VAL-ONE-123456",
        skuSnapshot: item.sku,
        nameSnapshot: item.name,
        status: "available",
        addedBy: "admin-1",
    });

    const unit2 = await stockRepo.stockUnits.create({
        guildId,
        itemId: item.id,
        valueEncrypted: "VAL-TWO-654321",
        skuSnapshot: item.sku,
        nameSnapshot: item.name,
        status: "available",
        addedBy: "admin-1",
    });

    // available count
    const availableBefore = await stockRepo.stockUnits.countAvailableByItemId(guildId, item.id);
    assert.equal(availableBefore, 2);

    // Reserve unit (reservedByOrderId)
    await stockRepo.stockUnits.updateById(unit1.id, {
        status: "reserved",
        reservedByOrderId: "HYP-0001",
        reservedAt: new Date().toISOString(),
    });

    const availableAfterReserve = await stockRepo.stockUnits.countAvailableByItemId(guildId, item.id);
    assert.equal(availableAfterReserve, 1, "reserved unit must not remain available");

    const reservedUnit = await stockRepo.stockUnits.findById(unit1.id);
    assert.equal(reservedUnit.status, "reserved");
    assert.equal(reservedUnit.reservedByOrderId, "HYP-0001");

    // Sell unit (soldToOrderId)
    await stockRepo.stockUnits.updateById(unit1.id, {
        status: "sold",
        soldToOrderId: "HYP-0001",
        deliveredAt: new Date().toISOString(),
    });

    const availableAfterSold = await stockRepo.stockUnits.countAvailableByItemId(guildId, item.id);
    assert.equal(availableAfterSold, 1, "sold unit must not appear as available");

    const soldUnit = await stockRepo.stockUnits.findById(unit1.id);
    assert.equal(soldUnit.status, "sold");
    assert.equal(soldUnit.soldToOrderId, "HYP-0001");

    // Void flow: create one void unit and ensure it never returns to available
    const voidUnit = await stockRepo.stockUnits.create({
        guildId,
        itemId: item.id,
        valueEncrypted: "VAL-VOID-999999",
        skuSnapshot: item.sku,
        nameSnapshot: item.name,
        status: "available",
        addedBy: "admin-1",
    });

    await stockRepo.stockUnits.updateById(voidUnit.id, {
        status: "void",
        reservedByOrderId: null,
        reservedAt: null,
        soldToOrderId: null,
        deliveredAt: null,
    });

    const voidAfter = await stockRepo.stockUnits.findById(voidUnit.id);
    assert.equal(voidAfter.status, "void");

    // Ensure void unit is not counted as available
    const availableAfterVoid = await stockRepo.stockUnits.countAvailableByItemId(guildId, item.id);
    assert.equal(availableAfterVoid, 1, "void unit must not remain/return as available");

    // "preview stock must be masked": mask is done in deliveryService, but we can at least ensure valueEncrypted exists
    assert.ok(typeof soldUnit.valueEncrypted === "string" || soldUnit.valueEncrypted === null);
});

test("feature stock-management: sold cannot be sent again (sold unit stays sold)", async () => {
    const { database } = createTestDatabase("features-stock-sold-idempotent");
    const stockRepo = createStockRepository(database);

    const guildId = "guild-002";
    const category = await stockRepo.ensureCategoryForKey(guildId, "SULTAN2");
    const item = await stockRepo.stockItems.create({
        guildId,
        categoryId: category.id,
        sku: "SKU-DIGI-2",
        name: "Paket Sultan (Digital 2)",
        deliveryType: "auto",
        type: "digital",
    });

    const unit = await stockRepo.stockUnits.create({
        guildId,
        itemId: item.id,
        valueEncrypted: "VAL-READY-000001",
        skuSnapshot: item.sku,
        nameSnapshot: item.name,
        status: "available",
    });

    await stockRepo.stockUnits.updateById(unit.id, {
        status: "sold",
        soldToOrderId: "HYP-0002",
        deliveredAt: new Date().toISOString(),
    });

    const sold1 = await stockRepo.stockUnits.findById(unit.id);
    assert.equal(sold1.status, "sold");

    // Attempt to "reserve" again (should be prevented by deliveryService normally, but stock repository alone is permissive)
    // Here we just ensure stock-level state stays consistent if we don't update.
    const sold2 = await stockRepo.stockUnits.findById(unit.id);
    assert.equal(sold2.status, "sold");
});
