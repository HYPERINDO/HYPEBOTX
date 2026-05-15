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
const { componentIds } = require("../../src/utils/constants");
const roles = require("../../src/config/roles");

function createService({ repositories }) {
    return createBacklogService({
        botConfig: {},
        logger: createSilentLogger(),
        repositories,
        loggingService: null,
        statusSyncService: null,
        orderService: {},
        paymentService: null,
    });
}

test("staging smoke: order ticket completed -> testimonial prompt appears (mock e2e)", async () => {
    const { database } = createTestDatabase("staging-order-live-smoke");
    const repositories = createAllRepositories(database);

    const guild = createFakeGuild({ id: "g-stg-1", name: "GuildStg" });

    const ticket = await repositories.ticketRepository.create({
        id: "T-STG-1",
        guildId: guild.id,
        channelId: "ch-stg-ticket",
        type: "order",
        status: "open",
        openerId: "cust-stg",
        meta: {},
    });

    const ticketChannel = createFakeChannel({ id: ticket.channelId, name: "order-stg-1" });
    guild.channels.cache.set(ticketChannel.id, ticketChannel);

    // backlogService uses ticketRepository.findByChannelId and orderRepository.findByTicketId
    await repositories.orderRepository.create({
        id: "O-STG-1",
        guildId: guild.id,
        ticketId: ticket.id,
        userId: ticket.openerId,
        price: "100000",
        status: "completed",
        paymentStatus: "paid",
        product: "pkg",
        adminNote: "",
        meta: {},
    });

    const backlogService = createService({ repositories });

    const staff = createFakeMember({ userId: "staff-stg", roles: [roles.staff] });
    const interaction = createFakeInteraction({
        userId: staff.id,
        guildId: guild.id,
        roles: [roles.staff],
        isOwner: false,
        channel: ticketChannel,
    });

    const res = await backlogService.handleQuickActionButton(interaction, componentIds.quickActionMarkCompleted);
    assert.ok(res?.ok === true || res === undefined, "quick action should succeed");

    const sent = ticketChannel._sent || [];
    const hasPrompt = sent.some((m) => {
        const content = String(m?.content || "");
        return content.includes("Order Selesai") && content.toLowerCase().includes("testimoni");
    });

    assert.ok(hasPrompt, "testimonial prompt should appear in ticket channel");
});
