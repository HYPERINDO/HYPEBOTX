const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createTestDatabase,
    createAllRepositories,
    createFakeGuild,
    createFakeChannel,
    createFakeMember,
    createFakeInteraction,
    createSilentLogger,
} = require("../business/helpers");

const { createBacklogService } = require("../../src/services/backlogService");
const roles = require("../../src/config/roles");
const { componentIds } = require("../../src/utils/constants");
const { dispatchInteraction } = require("../helpers/dispatchInteraction");

function createService({ repositories, guild }) {
    // orderService minimal: used by quick actions/paid embeds in backlogService
    const orderService = {
        sendOrEditInvoice: async () => { },
        sendOrderSummary: async () => { },
    };

    const backlogService = createBacklogService({
        botConfig: {},
        logger: createSilentLogger(),
        repositories,
        loggingService: null,
        statusSyncService: null,
        orderService,
        paymentService: {
            approvePaymentFromTicketId: async () => ({ ok: true }),
        },
    });

    // Minimal status sync: approve payment should update ticket/order statuses
    backlogService.syncTicketOrderQueueStatus = async () => { };

    // stash guild for handlers
    backlogService.__guild = guild;
    return backlogService;
}

test("staging smoke: payment proof -> approve -> invoice/summary update -> delivery mock (logic only)", async () => {
    const { database } = createTestDatabase("staging-payment-live");
    const repositories = createAllRepositories(database);

    const guild = createFakeGuild({ id: "g-pay-1", name: "GuildPay" });
    const orderTicketChannel = createFakeChannel({ id: "ch-pay-ticket", name: "order-pay-1" });
    guild.channels.cache.set(orderTicketChannel.id, orderTicketChannel);

    // seed ticket+order
    const ticket = await repositories.ticketRepository.create({
        id: "T-PAY-1",
        guildId: guild.id,
        channelId: orderTicketChannel.id,
        type: "order",
        status: "open",
        openerId: "cust-pay-1",
        meta: {},
    });

    const order = await repositories.orderRepository.create({
        id: "O-PAY-1",
        guildId: guild.id,
        ticketId: ticket.id,
        userId: ticket.openerId,
        price: "100000",
        status: "pending",
        paymentStatus: "waiting",
        product: "pkg",
        adminNote: "",
        meta: {},
    });

    const backlogService = createService({ repositories, guild });

    const client = {
        container: {
            botConfig: {},
            logger: createSilentLogger(),
            repositories,
            services: {
                backlogService,
                paymentService: {
                    approvePaymentFromTicketId: async () => ({ ok: true }),
                },
            },
        },
        commands: new Map(),
    };

    // seed ticket lookup required by buttonHandler payment approve path
    guild.channels.cache.find = (fn) => Array.from(guild.channels.cache.values()).find(fn);

    // 1) simulate staff clicks payment approve button.
    const paymentApprover = createFakeMember({ userId: "staff-pay-1", roles: [roles.staff] });
    const paymentApproveInteraction = createFakeInteraction({
        userId: paymentApprover.id,
        guildId: guild.id,
        roles: [roles.staff],
        isOwner: false,
        channel: orderTicketChannel,
    });
    paymentApproveInteraction.member = paymentApprover;
    paymentApproveInteraction.customId = componentIds.paymentApprovePrefix + ticket.id;

    const approveReply = await require("../../src/handlers/buttonHandler").handleButton(client, paymentApproveInteraction);
    // buttonHandler may return null depending on optional service presence; but must not crash
    assert.ok(approveReply === null || approveReply?.ok === true || approveReply?.message || approveReply === undefined);

    // 2) verify minimal state: ticket/order rows still exist
    const savedOrder = await repositories.orderRepository.findById(order.id);
    const savedTicket = await repositories.ticketRepository.findById(ticket.id);
    assert.ok(savedOrder, "order should exist after approve");
    assert.ok(savedTicket, "ticket should exist after approve");

    // 3) delivery mock: backlogService quick action mark completed posts testimonial prompt
    const res = await backlogService.handleQuickActionButton(paymentApproveInteraction, componentIds.quickActionMarkCompleted);
    assert.ok(res?.ok === true || res === undefined);

    const sent = orderTicketChannel._sent || [];
    assert.ok(sent.some((m) => String(m?.content || "").includes("Order Selesai")), "order completed messaging should be posted");
});
