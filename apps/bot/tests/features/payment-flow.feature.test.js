const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestDatabase, createAllRepositories, createFakeGuild, createFakeMember, createFakeInteraction } = require("../business/helpers");
const { createPaymentService } = require("../../src/services/paymentService");
const { createStoreOpsService } = require("../../src/services/storeOpsService");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

function createFakeMessage({
    guild,
    channelId,
    authorId,
    authorTag,
    attachments = [],
    member = null,
    messageId = "m-1",
} = {}) {
    return {
        id: messageId,
        inGuild: () => true,
        author: { id: authorId, bot: false, tag: authorTag, username: authorTag },
        member,
        guild,
        channel: { id: channelId },
        attachments: new Map(attachments.map((a, idx) => [String(idx), a])),
        react: async () => { },
        reply: async () => { },
    };
}

test("feature payment-flow (service-level): proof -> submitted; approve -> paid + delivery+invoice; reject -> cancelled + no delivery; double-approve blocked", async () => {
    const { database, paths } = createTestDatabase("features-payment-flow");

    const repositories = createAllRepositories(database);

    const guild = createFakeGuild();
    const staff = createFakeMember({ userId: "staff-1", roles: ["STAFF"] });
    const customer = createFakeMember({ userId: "cust-1", roles: ["MEMBER"] });

    // We must seed ticket + order so that paymentService can resolve by ticketId.
    // ticketId used in service is "0001" numeric-like in other repos, but here we use explicit id.
    const ticketId = "0001";
    const channelId = "ch-order-0001";

    const orderId = "HYP-0001";
    const order = {
        id: orderId,
        guildId: guild.id,
        ticketId,
        userId: customer.user.id,
        product: "SKU-DIGI-1",
        category: "digital",
        detail: "Test detail",
        status: "waiting",
        paymentStatus: "unpaid",
        staffHandle: staff.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sku: "SKU-DIGI-1",
        orderSummaryMessageId: null,
        invoiceMessageId: null,
    };

    const ticket = {
        id: ticketId,
        guildId: guild.id,
        channelId,
        openerId: customer.user.id,
        type: "order",
        status: "open",
        orderStatus: "waiting_payment_proof",
        meta: {
            formType: "order",
            detail: "Test detail",
            paymentNote: "Test note",
        },
    };

    // Seed orders/tickets directly into DB files
    await database.write("orders", [order]);
    await database.write("tickets", [ticket]);
    await database.write("payments", []);

    let syncCalls = [];
    const statusSyncService = {
        syncTicketOrderQueueStatus: async ({ status }) => {
            syncCalls.push(status);
            return { ok: true };
        },
    };

    let summaryCalls = 0;
    let invoiceCalls = 0;

    const orderService = {
        sendOrderSummary: async () => { summaryCalls += 1; return { ok: true }; },
        sendOrEditInvoice: async () => { invoiceCalls += 1; return { ok: true }; },
    };

    let deliveryCalls = 0;
    const deliveryService = {
        tryAutoDeliver: async () => { deliveryCalls += 1; return { ok: true }; },
    };

    const loggingService = {
        logPayment: async () => { },
    };

    const paymentService = createPaymentService({
        botConfig: { storeName: "HYPEBOTX" },
        logger: createSilentLogger(),
        repositories,
        loggingService,
        statusSyncService,
        getJokiService: () => null,
        deliveryService,
        orderService,
        ticketService: null,
    });

    // -------- 1) handlePaymentProofMessage --------
    const interactionLike = createFakeInteraction({
        guildId: guild.id,
        userId: staff.user.id,
        roles: ["STAFF"],
    });

    const proofUrl = "https://example.com/proof1.png";
    const message = createFakeMessage({
        guild,
        channelId,
        authorId: customer.user.id,
        authorTag: "Customer#0001",
        member: customer,
        messageId: "m-proof-1",
        attachments: [
            {
                contentType: "image/png",
                url: proofUrl,
                name: "proof1.png",
            },
        ],
    });

    const createdPayment = await paymentService.handlePaymentProofMessage(message);
    assert.ok(createdPayment, "payment should be created");
    assert.equal(createdPayment.status, "submitted");

    // Verify order paymentStatus submitted
    const updatedOrder = await repositories.orderRepository.findById(orderId);
    assert.equal(updatedOrder.paymentStatus, "submitted");

    // statusSync should get called with "waiting" (from handlePaymentProofMessage)
    assert.ok(syncCalls.includes("waiting"), "sync should include waiting after proof");

    // -------- 2) rejectPayment: reason wajib, no delivery --------
    // We need a relatedTicket found by channelId inside handlePaymentRejectReasonModal
    const rejectInteraction = createFakeInteraction({
        guildId: guild.id,
        userId: staff.user.id,
        roles: ["STAFF"],
        isOwner: true,
        options: {},
    });

    // Emulate modal fields
    rejectInteraction.fields = {
        getTextInputValue: () => "Reason test",
    };

    // method calls rejectPaymentFromTicketId via handlePaymentRejectReasonModal
    rejectInteraction.channel = { id: channelId };

    // Ensure ticket order still exists; paymentService will find payment by ticketId
    const rejectResult = await paymentService.handlePaymentRejectReasonModal(rejectInteraction);
    assert.ok(rejectResult, "reject should return payment object");
    assert.equal(rejectResult.ok, true);

    const paymentsAfterReject = await repositories.paymentRepository.getAll();
    const lastPaymentAfterReject = paymentsAfterReject[paymentsAfterReject.length - 1];
    assert.equal(lastPaymentAfterReject.status, "cancelled");
    assert.equal(lastPaymentAfterReject.note, "Reason test");
    assert.equal(deliveryCalls, 0, "delivery must not be called on reject");

    // -------- 3) Approve payment: paid -> delivery+summary+invoice --------
    // We re-seed payment to "submitted" so approve works, because we rejected it.
    // Create a new payment record similar to handlePaymentProofMessage.
    const newPaymentId = "PAY-100";
    const paymentSeed = {
        id: newPaymentId,
        guildId: guild.id,
        userId: customer.user.id,
        ticketId,
        orderId,
        status: "submitted",
        method: "image-proof",
        amount: "",
        note: "",
        proofUrls: [proofUrl],
        messageId: "m-proof-2",
        channelId,
        createdAt: new Date().toISOString(),
        checkedBy: null,
        checkedAt: null,
    };
    await database.update("payments", [], (current) => {
        const rows = Array.isArray(current) ? [...current] : [];
        rows.push(paymentSeed);
        return rows;
    });

    // Approve from ticketId
    const approveInteraction = createFakeInteraction({
        guildId: guild.id,
        userId: staff.user.id,
        roles: ["STAFF"],
    });
    approveInteraction.guild = guild;
    approveInteraction.user = staff.user;
    approveInteraction.user.tag = "Staff#0001";
    approveInteraction.channel = { isTextBased: () => true };

    // approvePaymentFromTicketId requires (interaction, relatedTicket, ticketIdSuffix)
    const rejectTicket = await repositories.ticketRepository.findById(ticketId);
    const approveResult = await paymentService.approvePaymentFromTicketId(approveInteraction, rejectTicket);
    assert.ok(approveResult, "approve should return payment");

    const paymentsAfterApprove = await repositories.paymentRepository.getAll();
    const lastPayment = paymentsAfterApprove[paymentsAfterApprove.length - 1];
    assert.equal(lastPayment.status, "paid");

    const orderAfterApprove = await repositories.orderRepository.findByTicketId(ticketId);
    assert.equal(orderAfterApprove.paymentStatus, "paid");
    assert.equal(orderAfterApprove.status, "paid");

    assert.equal(deliveryCalls, 1, "delivery must be called once on approve");
    assert.ok(summaryCalls >= 1, "sendOrderSummary should be called");
    assert.ok(invoiceCalls >= 1, "sendOrEditInvoice should be called");

    // -------- 4) Double approve blocked --------
    const doubleApprove = await paymentService.approvePaymentFromTicketId(approveInteraction, rejectTicket);
    assert.ok(doubleApprove, "double approve returns something");
    assert.equal(deliveryCalls, 1, "delivery should not be called again on double approve");
});
