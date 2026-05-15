const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("fs");
const path = require("path");

const { createDatabase } = require("../../src/database/connection");
const { createStockRepository } = require("../../src/repositories/stockRepository");
const { createOrderRepository } = require("../../src/repositories/orderRepository");
const { createPaymentRepository } = require("../../src/repositories/paymentRepository");
const { createDeliveryService } = require("../../src/services/deliveryService");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-stock-"));
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

function createMockGuild() {
    const sent = { dms: [] };
    const guild = {
        id: "guild-1",
        name: "Guild One",
        members: {
            fetch: async (userId) => ({
                id: userId,
                send: async ({ embeds }) => {
                    sent.dms.push({ userId, embedsLen: Array.isArray(embeds) ? embeds.length : 0 });
                    return { id: `dm-${sent.dms.length}` };
                },
            }),
        },
        channels: {
            cache: {
                get() {
                    return null;
                },
            },
            fetch: async () => null,
        },
    };
    return { guild, sent };
}

test("stock consistency: auto-delivery moves reserved->sold and avoids double-send", async () => {
    const paths = createTempPaths();
    const logger = createSilentLogger();
    const database = createDatabase(paths, logger);
    database.init();

    const stockRepository = createStockRepository(database);
    const orderRepository = createOrderRepository(database);
    const paymentRepository = createPaymentRepository(database);

    const guild = createMockGuild();
    const deliveryService = createDeliveryService({
        botConfig: {},
        logger,
        database,
        repositories: { stockRepository, orderRepository, paymentRepository },
        loggingService: {
            logOrder: async () => { },
        },
    });

    // Seed: stock item + units
    const guildId = guild.guild.id;

    const item = await stockRepository.stockItems.create({
        id: "item-1",
        guildId,
        sku: "SKU-1",
        name: "Digital Product 1",
        deliveryType: "auto",
        type: "digital",
        price: "",
        isActive: true,
    });

    const unit = await stockRepository.stockUnits.create({
        id: "unit-1",
        guildId,
        itemId: item.id,
        status: "available",
        reservedByOrderId: null,
        reservedAt: null,
        soldToOrderId: null,
        deliveredAt: null,
        valueEncrypted: "ENCRYPTED_VALUE_12345",
        addedBy: "seed",
    });

    // Seed: order linked by ticketId
    const ticketId = "TKT-0001";
    const order = await orderRepository.create({
        id: "ORD-0001",
        guildId,
        ticketId,
        userId: "user-1",
        sku: "SKU-1",
        product: "Digital Product 1",
        detail: "test",
        status: "paid",
        paymentStatus: "paid",
    });

    // Call delivery twice sequentially: second should be blocked by anti-double delivery
    const r1 = await deliveryService.tryAutoDeliver(guild.guild, ticketId);
    const r2 = await deliveryService.tryAutoDeliver(guild.guild, ticketId);

    assert.equal(r1.ok, true);
    assert.equal(r2.ok, false);

    // Assert stock unit sold, not lost
    const units = await stockRepository.stockUnits.getAll(guildId);
    const sold = units.find((u) => u.id === unit.id);
    assert.equal(sold.status, "sold");
    assert.equal(sold.soldToOrderId, order.id);

    // Assert only one DM send
    assert.equal(guild.sent.dms.length, 1);
});

test("stock consistency: race delivery should not double-sell/double-send", async () => {
    const paths = createTempPaths();
    const logger = createSilentLogger();
    const database = createDatabase(paths, logger);
    database.init();

    const stockRepository = createStockRepository(database);
    const orderRepository = createOrderRepository(database);
    const paymentRepository = createPaymentRepository(database);

    const guild = createMockGuild();
    const deliveryService = createDeliveryService({
        botConfig: {},
        logger,
        database,
        repositories: { stockRepository, orderRepository, paymentRepository },
        loggingService: { logOrder: async () => { } },
    });

    const guildId = guild.guild.id;

    const item = await stockRepository.stockItems.create({
        id: "item-1",
        guildId,
        sku: "SKU-1",
        name: "Digital Product 1",
        deliveryType: "auto",
        type: "digital",
        price: "",
        isActive: true,
    });

    // One unit only to amplify race condition
    await stockRepository.stockUnits.create({
        id: "unit-1",
        guildId,
        itemId: item.id,
        status: "available",
        reservedByOrderId: null,
        reservedAt: null,
        soldToOrderId: null,
        deliveredAt: null,
        valueEncrypted: "ENCRYPTED_VALUE_12345",
        addedBy: "seed",
    });

    const ticketId = "TKT-0002";
    const order = await orderRepository.create({
        id: "ORD-0002",
        guildId,
        ticketId,
        userId: "user-1",
        sku: "SKU-1",
        product: "Digital Product 1",
        detail: "test",
        status: "paid",
        paymentStatus: "paid",
    });

    // Two concurrent delivery calls for the same ticket/order
    const [a, b] = await Promise.allSettled([
        deliveryService.tryAutoDeliver(guild.guild, ticketId),
        deliveryService.tryAutoDeliver(guild.guild, ticketId),
    ]);

    // Exactly one should succeed
    const okCount = [a, b].filter((r) => r.status === "fulfilled" && r.value && r.value.ok).length;
    assert.equal(okCount, 1);

    const units = await stockRepository.stockUnits.getAll(guildId);
    const sold = units.find((u) => u.id === "unit-1");
    assert.equal(sold.status, "sold");
    assert.equal(sold.soldToOrderId, order.id);

    assert.equal(guild.sent.dms.length, 1);
});
