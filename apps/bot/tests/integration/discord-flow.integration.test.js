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
const { handleButton } = require("../../src/handlers/buttonHandler");
const { handleModal } = require("../../src/handlers/modalHandler");
const roles = require("../../src/config/roles");

function createServices({ guild, repositories }) {
    const backlogService = createBacklogService({
        botConfig: {},
        logger: createSilentLogger(),
        repositories,
        loggingService: null,
        statusSyncService: null,
        orderService: {
            sendOrderSummary: async () => { },
            sendOrEditInvoice: async () => { },
            handleOrderFormModal: async () => null,
            handleTopupFormModal: async () => null,
            handleWarrantyModal: async () => null,
            handleWindowsLicenseModal: async () => null,
            handleOfficeLicenseModal: async () => null,
            handleOptimizerModal: async () => null,
            handleGameAccountModal: async () => null,
            handleDiscordServerModal: async () => null,
            handleBundlePackageModal: async () => null,
        },
        paymentService: null,
    });

    return {
        backlogService,
        repositories,
        // Minimal container shape expected by handlers
        botConfig: {},
        logger: createSilentLogger(),
        services: { backlogService },
        repositories: { ...repositories },
    };
}

test("integration: order completed quick action -> show testimonial modal -> submit testimonial persists + duplicate rejected", async () => {
    const { database } = createTestDatabase("integration-discord-flow-testi");

    const repositories = createAllRepositories(database);
    const guild = createFakeGuild({ id: "g-int-1", name: "GuildInt" });

    const testimonialsChannel = createFakeChannel({ id: "ch-testi-1", name: "testimonials" });
    guild.channels.cache.set(testimonialsChannel.id, testimonialsChannel);
    guild.channels.cache.find = (fn) => Array.from(guild.channels.cache.values()).find(fn);

    const ticket = await repositories.ticketRepository.create({
        id: "T-INT-1",
        guildId: guild.id,
        channelId: "ch-ticket-1",
        type: "order",
        status: "open",
        openerId: "cust-int",
        meta: {},
    });

    const order = await repositories.orderRepository.create({
        id: "O-INT-1",
        guildId: guild.id,
        ticketId: ticket.id,
        userId: "cust-int",
        price: "100000",
        status: "completed",
        paymentStatus: "paid",
        product: "pkg",
        adminNote: "",
        meta: {},
    });

    const ticketChannel = createFakeChannel({ id: ticket.channelId, name: "order-int-1" });
    guild.channels.cache.set(ticketChannel.id, ticketChannel);

    const container = createServices({ guild, repositories });

    const client = {
        container,
        commands: new Map(),
    };

    const staff = createFakeMember({ userId: "staff-int", roles: [roles.staff] });
    const customer = createFakeMember({ userId: "cust-int", roles: [roles.member] });

    const fakeButtonInteraction = {
        ...createFakeInteraction({
            userId: staff.id,
            guildId: guild.id,
            roles: [roles.staff],
            isOwner: false,
            channel: ticketChannel,
        }),
        customId: componentIds.quickActionMarkCompleted,
        // Handlers refer to interaction.member
        member: staff,
        guild,
        user: staff.user,
        channel: ticketChannel,
        client,
    };

    await handleButton(client, fakeButtonInteraction);

    // Ensure modal can be routed with customId.testimoniModal by calling handleModal directly
    const modalInteraction = {
        customId: componentIds.testimoniModal,
        guild,
        channel: ticketChannel,
        user: customer.user,
        member: customer,
        fields: {
            getTextInputValue: (name) => {
                if (name === "rating") return "4";
                if (name === "message") return "testimoni integration";
                return null;
            },
        },
        replied: false,
        deferred: false,
        reply: async (payload) => payload,
    };

    const modalCtx = { container };
    const result1 = await handleModal(modalCtx, modalInteraction);
    // In this integration test, we just need that it responded with an ok reply
    assert.ok(result1, "modal handler should return a reply/payload");

    const all = await repositories.opsRepository.testimonials.getAll();
    const created = all.find((row) => row.orderId === order.id && row.userId === customer.id);
    assert.ok(created, "testimonial must be persisted for order+user");

    // Duplicate via service directly through modal again
    const modalInteractionDup = {
        ...modalInteraction,
        fields: {
            getTextInputValue: (name) => {
                if (name === "rating") return "4";
                if (name === "message") return "duplicate";
                return null;
            },
        },
    };

    const result2 = await handleModal(modalCtx, modalInteractionDup);
    assert.ok(result2, "duplicate modal handler should respond");

    const all2 = await repositories.opsRepository.testimonials.getAll();
    const afterDupCount = all2.filter((row) => row.orderId === order.id && row.userId === customer.id).length;
    assert.equal(afterDupCount, 1, "duplicate testimonial must be rejected (no extra row)");
});
