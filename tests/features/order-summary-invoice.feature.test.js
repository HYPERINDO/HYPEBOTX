const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestDatabase, createAllRepositories, createFakeGuild, createFakeMember } = require("../business/helpers");

const { createOrderService } = require("../../src/services/orderService");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

function createFakeTextChannel() {
    const sent = new Map();
    let seq = 1;

    return {
        id: "ch-invoice-001",
        guild: { id: "guild-001", name: "TestGuild" },
        isTextBased: () => true,
        messages: {
            fetch: async (id) => {
                return sent.get(id) || null;
            },
        },
        send: async ({ content, embeds }) => {
            const id = `msg-${seq++}`;
            const embed = embeds?.[0] || null;
            const msg = {
                id,
                editable: true,
                embeds: [embed],
                content,
                edit: async ({ embeds: nextEmbeds, content: nextContent } = {}) => {
                    if (typeof nextContent !== "undefined") msg.content = nextContent;
                    if (nextEmbeds) msg.embeds = nextEmbeds;
                    return msg;
                },
            };
            sent.set(id, msg);
            return msg;
        },
        _sent: sent,
    };
}

test("feature order-summary-invoice: summary/invoice create+edit in-place; invoice number=order ID", async () => {
    const { database } = createTestDatabase("features-order-summary-invoice");
    const repositories = createAllRepositories(database);
    const guild = createFakeGuild();
    const staff = createFakeMember({ userId: "staff-1", roles: ["STAFF"] });

    const channel = createFakeTextChannel();

    // seed order
    const ticketId = "T-0001";
    const orderId = "HYP-0001";
    await database.write("orders", [
        {
            id: orderId,
            guildId: guild.id,
            ticketId,
            userId: "cust-1",
            customerName: "CustomerA",
            category: "joki",
            product: "Paket Sultan",
            price: "649000",
            detail: "detail",
            status: "paid",
            paymentStatus: "paid",
            staffHandle: staff.user.id,
            sku: "SKU-DIGI-1",
            orderSummaryMessageId: null,
            invoiceMessageId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ]);

    const orderService = createOrderService({
        botConfig: {},
        logger: createSilentLogger(),
        repositories,
        ticketService: {},
        roleService: {},
        loggingService: { logOrder: async () => { }, logPayment: async () => { }, logBot: async () => { }, logOrder: async () => { }, logPayment: async () => { } },
        getJokiService: () => null,
        statusSyncService: null,
    });

    const interaction = {
        guild,
        user: { id: staff.user.id, tag: "Staff#0001" },
    };

    // 1) create new summary
    await orderService.sendOrderSummary(
        channel,
        "ORDER BARU",
        "detail long",
        0x57f287,
        { ticket: { id: ticketId, meta: { formType: "joki", customerName: "CustomerA" } }, interaction, product: "Paket Sultan", order: { id: orderId }, meta: { formType: "joki" } },
        orderId,
        ticketId,
    );

    let orderAfterSummary1 = await repositories.orderRepository.findById(orderId);
    assert.ok(orderAfterSummary1.orderSummaryMessageId, "orderSummaryMessageId should be saved");
    const summaryMsgId = orderAfterSummary1.orderSummaryMessageId;

    // 2) edit existing summary in-place (same orderId)
    await orderService.sendOrderSummary(
        channel,
        "ORDER BARU",
        "detail edited",
        0x57f287,
        { ticket: { id: ticketId, meta: { formType: "joki", customerName: "CustomerA" } }, interaction, product: "Paket Sultan", order: { id: orderId }, meta: { formType: "joki" } },
        orderId,
        ticketId,
    );

    const orderAfterSummary2 = await repositories.orderRepository.findById(orderId);
    assert.equal(orderAfterSummary2.orderSummaryMessageId, summaryMsgId, "summary should not create a duplicate message");

    // 3) create invoice
    await orderService.sendOrEditInvoice({
        channel,
        interaction,
        order: orderAfterSummary2,
        orderId: orderId,
        repositories,
    });

    let orderAfterInvoice1 = await repositories.orderRepository.findById(orderId);
    assert.ok(orderAfterInvoice1.invoiceMessageId, "invoiceMessageId should be saved");
    const invoiceMsgId = orderAfterInvoice1.invoiceMessageId;

    // 4) edit invoice in-place
    await orderService.sendOrEditInvoice({
        channel,
        interaction,
        order: orderAfterInvoice1,
        orderId: orderId,
        repositories,
    });

    const orderAfterInvoice2 = await repositories.orderRepository.findById(orderId);
    assert.equal(orderAfterInvoice2.invoiceMessageId, invoiceMsgId, "invoice should not create a duplicate message");

    // Validate invoice embed number = order ID using stored embed title/field via fake message
    const invoiceMsg = await channel.messages.fetch(invoiceMsgId);
    assert.ok(
        JSON.stringify(invoiceMsg || {}).includes(orderId),
        "invoice message payload should contain orderId",
    );
});
