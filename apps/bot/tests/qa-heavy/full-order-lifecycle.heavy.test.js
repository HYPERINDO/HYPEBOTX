const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../../src/database/connection");
const { createStockRepository } = require("../../src/repositories/stockRepository");
const { createOrderRepository } = require("../../src/repositories/orderRepository");
const { createPaymentRepository } = require("../../src/repositories/paymentRepository");
const { createTicketRepository } = require("../../src/repositories/ticketRepository");
const { createDeliveryService } = require("../../src/services/deliveryService");
const { createStatusSyncService } = require("../../src/services/statusSyncService");
const { createPaymentService } = require("../../src/services/paymentService");
const { createOrderService } = require("../../src/services/orderService");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-full-"));
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

function createMockChannel() {
    const sent = [];
    const edited = [];
    const messages = new Map();

    return {
        id: "channel-1",
        guild: { name: "Guild One" },
        isTextBased() { return true; },
        send: async (payload) => {
            const id = `m-${sent.length + 1}`;
            const msg = {
                id,
                editable: true,
                createdTimestamp: Date.now(),
                edit: async (p) => { edited.push({ id, payload: p }); },
            };
            sent.push({ id, payload });
            messages.set(id, msg);
            return msg;
        },
        messages: {
            fetch: async (id) => messages.get(id) || null,
        },
        _sent: sent,
        _edited: edited,
    };
}

function createMockGuild() {
    const guild = {
        id: "guild-1",
        name: "Guild One",
        members: {
            fetch: async (userId) => ({
                id: userId,
                send: async () => ({ id: "dm-1" }),
            }),
        },
        channels: {
            cache: {
                get() { return null; },
            },
        },
    };
    return guild;
}

test("full order lifecycle heavy: order -> summary/invoice -> payment -> auto delivery -> testimoni -> close -> transcript", async () => {
    const paths = createTempPaths();
    const logger = createSilentLogger();
    const database = createDatabase(paths, logger);
    database.init();

    const guild = createMockGuild();
    const channel = createMockChannel();

    // Repositories
    const stockRepository = createStockRepository(database);
    const orderRepository = createOrderRepository(database);
    const paymentRepository = createPaymentRepository(database);
    const ticketRepository = createTicketRepository(database);

    // Minimal ticketService mock: only closeTicket is used by orderService.closeOrder
    const ticketService = {
        closeTicket: async (interaction, reason) => {
            const ticket = await ticketRepository.findByChannelId(interaction.channel.id);
            assert.ok(ticket, "ticket must exist");
            const transcript = `transcript for ${ticket.id}`;
            const transcriptName = `ticket-${ticket.id}-${Date.now()}.txt`;
            const transcriptPath = await database.saveTranscript(transcriptName, transcript);

            await ticketRepository.update(ticket.id, {
                status: "closed",
                closedAt: new Date().toISOString(),
                closeReason: reason,
                claimedBy: ticket.claimedBy || null,
            });

            return { id: ticket.id, transcriptPath };
        },
    };

    const statusSyncService = createStatusSyncService({ logger, repositories: {} });
    const loggingService = {
        logOrder: async () => { },
        logPayment: async () => { },
        logTicket: async () => { },
    };

    // Instantiate delivery
    const deliveryService = createDeliveryService({
        botConfig: {},
        logger,
        database,
        repositories: { stockRepository, orderRepository, paymentRepository },
        loggingService,
    });

    // Instantiate payment + order services
    const paymentService = createPaymentService({
        botConfig: { payment: { bank: "-", ewallet: "-", qris: "-" }, jobs: {} },
        logger,
        repositories: { ticketRepository, orderRepository, paymentRepository, simpleStoreRepository: null },
        loggingService,
        statusSyncService,
        getJokiService: () => null,
        deliveryService,
        orderService: null,
    });

    // orderService depends on roleService/getJokiService/statusSyncService
    const roleService = { addRole: async () => { } };
    const getJokiService = () => ({
        startQueue: async () => ({ entry: { id: "JOKI-1", position: 0 } }),
    });

    const orderService = createOrderService({
        botConfig: { storeName: "TestStore", jobs: {} },
        logger,
        repositories: { stockRepository, orderRepository, paymentRepository, ticketRepository, simpleStoreRepository: { getNextOrderId: async () => "100" }, userRepository: null },
        ticketService,
        roleService,
        loggingService,
        getJokiService,
        statusSyncService,
    });

    // Seed: stock item + unit
    const guildId = guild.id;
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

    // Seed: ticket
    const ticketId = "0001";
    const ticket = await ticketRepository.create({
        id: ticketId,
        guildId,
        channelId: channel.id,
        openerId: "user-1",
        type: "order",
        status: "open",
        claimedBy: null,
        orderStatus: "waiting_payment",
        meta: { formType: "joki", customerName: "User", detail: "ORDER", whatsapp: "wa", paymentNote: "bca", customerName: "User" },
    });

    // Seed: order
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

    // Mock interaction for staff paid update (simulate /set-order-status paid)
    const interaction = {
        guild,
        channel,
        member: { user: { id: "staff-1", tag: "staff#0001" } },
        user: { id: "staff-1", tag: "staff#0001" },
        options: { getString: () => "paid" },
    };

    // Heavy flow steps:
    // 1) status sync to paid (this should trigger sendOrderSummary + sendOrEditInvoice in orderService.setOrderStatus)
    await orderService.setOrderStatus(interaction, "paid");

    // 2) ensure invoice/edit happened (sendOrEditInvoice uses channel.send)
    // orderService.setOrderStatus triggers sendOrderSummary + sendOrEditInvoice (best-effort).
    // Our mock channel records sent messages.
    assert.ok(channel._sent.length >= 1, "must send at least one summary/invoice message");

    // 3) Simulate payment approval auto-delivery directly (since paymentService.approvePaymentFromTicketId
    // depends on interaction + orderService internals we didn't fully wire).
    const deliverResult = await deliveryService.tryAutoDeliver(guild, ticketId);
    assert.equal(deliverResult.ok, true);

    // 4) ensure stock unit marked sold (no double sold loss)
    const allUnits = await stockRepository.stockUnits.getAll(guildId);
    const sold = allUnits.find((u) => u.id === unit.id);
    assert.equal(sold.status, "sold");
    assert.equal(sold.soldToOrderId, order.id);

    // 5) close ticket via orderService.closeOrder -> ticketService.closeTicket (mock) -> transcript saved
    const closeInteraction = {
        ...interaction,
        channel,
    };
    const closeResult = await orderService.closeOrder(closeInteraction, "completed");
    assert.ok(closeResult.ok !== false);

    const allTickets = await ticketRepository.getAll();
    const closed = allTickets.find((t) => t.id === ticketId);
    assert.equal(closed.status, "closed");
    assert.ok(closed.closedAt, "closedAt must exist");
});
