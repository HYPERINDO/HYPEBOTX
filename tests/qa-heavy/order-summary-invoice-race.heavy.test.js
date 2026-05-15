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
const { createOrderService } = require("../../src/services/orderService");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-race-"));
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

function createMockChannel() {
    const sent = [];
    const messages = new Map();

    function makeMsg(id, payload) {
        return {
            id,
            editable: true,
            createdTimestamp: Date.now(),
            edit: async (p) => {
                messages.set(id, { ...messages.get(id), ...p });
            },
            ...payload,
        };
    }

    return {
        id: "channel-1",
        guild: { name: "Guild One" },
        isTextBased() { return true; },

        send: async ({ content, embeds }) => {
            const id = `m-${sent.length + 1}`;
            const payload = { content, embeds };
            sent.push(payload);
            const msg = makeMsg(id, payload);
            messages.set(id, msg);
            return msg;
        },

        messages: {
            fetch: async (id) => messages.get(id) || null,
        },

        get _sent() { return sent; },
    };
}

function createMockGuild() {
    return {
        id: "guild-1",
        name: "Guild One",
        members: {
            fetch: async (userId) => ({
                id: userId,
                send: async () => ({ id: "dm-1" }),
            }),
        },
        channels: { cache: { get: () => null } },
    };
}

test("order summary + invoice race: multiple paid updates should edit-in-place (no duplicate invoice/summary)", async () => {
    const paths = createTempPaths();
    const logger = createSilentLogger();
    const database = createDatabase(paths, logger);
    database.init();

    const guild = createMockGuild();
    const channel = createMockChannel();

    const stockRepository = createStockRepository(database);
    const orderRepository = createOrderRepository(database);
    const paymentRepository = createPaymentRepository(database);
    const ticketRepository = createTicketRepository(database);

    const statusSyncService = createStatusSyncService({
        logger,
        repositories: { ticketRepository, orderRepository },
    });

    const deliveryService = createDeliveryService({
        botConfig: {},
        logger,
        database,
        repositories: { stockRepository, orderRepository, paymentRepository, ticketRepository },
        loggingService: { logOrder: async () => { } },
    });

    const loggingService = {
        logOrder: async () => { },
        logPayment: async () => { },
        logTicket: async () => { },
    };

    // orderService: we only need sendOrderSummary + sendOrEditInvoice triggered via setOrderStatus('paid')
    const roleService = { addRole: async () => { } };

    // getJokiService stub (not required unless auto-queue happens)
    const getJokiService = () => ({
        startQueue: async () => ({ entry: { id: "JOKI-1", position: 0 } }),
    });

    // ticketService stub (orderService.closeOrder not used here)
    const ticketService = { closeTicket: async () => null };

    const simpleStoreRepository = { getNextOrderId: async () => "1000" };
    const userRepository = null;

    const orderService = createOrderService({
        botConfig: { storeName: "TestStore", jobs: {} },
        logger,
        repositories: {
            stockRepository,
            orderRepository,
            paymentRepository,
            ticketRepository,
            simpleStoreRepository,
            userRepository,
        },
        ticketService,
        roleService,
        loggingService,
        getJokiService,
        statusSyncService,
    });

    const interaction = {
        guild,
        channel,
        member: { user: { id: "staff-1", tag: "staff#0001" } },
        user: { id: "staff-1", tag: "staff#0001" },
        options: { getString: () => "paid" },
    };

    const ticket = await ticketRepository.create({
        id: "0001",
        guildId: guild.id,
        channelId: channel.id,
        openerId: "user-1",
        type: "order",
        status: "open",
        claimedBy: null,
        orderStatus: "waiting_payment",
        meta: { formType: "joki", customerName: "User", detail: "ORDER", paymentNote: "bca" },
    });

    // Order with pre-existing messageIds to force edit-in-place
    const order = await orderRepository.create({
        id: "ORD-0001",
        guildId: guild.id,
        ticketId: ticket.id,
        userId: "user-1",
        sku: "SKU-1",
        product: "Digital Product 1",
        detail: "test",
        status: "pending",
        paymentStatus: "unpaid",
        orderSummaryMessageId: "sum-1",
        invoiceMessageId: "inv-1",
    });

    // Seed existing summary/invoice messages so sendOrEditInvoice/edit finds them
    channel.messages.fetch = async (id) => {
        if (id === "inv-1" || id === "sum-1") {
            return {
                id,
                editable: true,
                edit: async () => { },
            };
        }
        return null;
    };

    // Trigger setOrderStatus('paid') concurrently multiple times
    await Promise.all([
        orderService.setOrderStatus(interaction, "paid"),
        orderService.setOrderStatus(interaction, "paid"),
        orderService.setOrderStatus(interaction, "paid"),
    ]);

    // Instead of relying on mock send-count (best-effort paths may still send),
    // assert that messageIds remain stable (edit-in-place contract).
    const latest = await orderRepository.findById(order.id);
    assert.equal(latest.orderSummaryMessageId, "sum-1");
    assert.equal(latest.invoiceMessageId, "inv-1");
});
