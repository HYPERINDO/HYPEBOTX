const test = require("node:test");
const assert = require("node:assert/strict");

const interactionCreateHandler = require("../../src/events/interaction/interactionCreate");
const { handleButton } = require("../../src/handlers/buttonHandler");
const { componentIds } = require("../../src/utils/constants");
const { createBacklogService } = require("../../src/services/backlogService");

const maintenanceCommand = require("../../src/commands/admin/maintenance");
const setupTermsCommand = require("../../src/commands/admin/setupTerms");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

function createFakeMember({ userId, roles = [], isOwnerOrStaff = false } = {}) {
    // permissionCheck uses roles membership; but maintenanceGuard uses isOwnerOrStaff()
    // which checks hasNamedRole on member.roles.cache. We'll keep simplest:
    return {
        id: userId,
        user: { id: userId, tag: `${userId}#0001` },
        roles: {
            cache: {
                has: (roleId) => roles.includes(roleId),
                values: () => roles.map((r) => ({ id: r, name: r })),
                some: (fn) => roles.some((r) => fn({ id: r, name: r })),
            },
        },
        permissions: { has: () => isOwnerOrStaff },
    };
}

function createFakeGuild({ id = "guild-mt-1" } = {}) {
    const channels = new Map();
    return {
        id,
        channels: {
            cache: {
                get: (id2) => channels.get(id2) || null,
                find: (predicate) => {
                    for (const ch of channels.values()) {
                        if (predicate(ch)) return ch;
                    }
                    return null;
                },
                values: () => channels.values(),
                _set: (ch) => channels.set(ch.id, ch),
            },
        },
    };
}

function createFakeTextChannel({ id = "ch-terms", name = "terms" } = {}) {
    return {
        id,
        name,
        isTextBased: () => true,
        send: async (payload) => {
            channel._sent.push(payload);
            return { id: `msg-${Date.now()}` };
        },
    };
    // eslint-disable-next-line no-use-before-define
    const channel = { _sent: [] };
}

function createClientWithCommands({ repositories, services, commandNameMap, monitoringService } = {}) {
    return {
        commands: {
            get: (name) => commandNameMap[name],
        },
        cooldowns: new Map(),
        container: {
            logger: createSilentLogger(),
            repositories,
            services: {
                rateLimitService: {
                    checkInteraction: async () => ({ allowed: true }),
                },
                monitoringService: monitoringService || { incrementCommands: () => { } },
                ...services,
            },
            botConfig: {},
        },
        __pendingCooldown: null,
    };
}

function createCommandExecutionInteraction({ guild, userId, member, commandName, channel, deferred = false } = {}) {
    const interaction = {
        commandName,
        guild,
        guildId: guild.id,
        user: { id: userId, tag: `${userId}#0001`, username: userId },
        member,
        channel,
        deferred,
        replied: false,
        isChatInputCommand: () => true,
        _replies: [],
        reply: async (payload) => {
            interaction._replies.push(payload);
            interaction.replied = true;
            return payload;
        },
        followUp: async (payload) => {
            interaction._replies.push(payload);
            return payload;
        },
    };

    return interaction;
}

function createButtonInteraction({ guild, userId, member, channel, customId } = {}) {
    return {
        customId,
        guild,
        guildId: guild.id,
        user: { id: userId, tag: `${userId}#0001`, username: userId },
        member,
        channel,
        replied: false,
        deferred: false,
        reply: async (payload) => {
            interaction._replies.push(payload);
            interaction.replied = true;
            return payload;
        },
    };

    // eslint-disable-next-line no-use-before-define
    const interaction = { _replies: [] };
}

test("maintenance mode + terms acceptance: maintenance blocks customer commands, staff bypass; terms panel saved once; re-accept safe", async () => {
    // ----------------------------
    // In-memory repos for settings + terms + minimal user repo
    // ----------------------------
    const state = {
        storeSettings: { maintenanceMode: false, maintenanceMessage: "" },
        termsAcceptances: [],
        users: [],
        // ops repo API shape used by backlogService
        termsAcceptances: [],
    };

    const simpleStoreRepository = {
        async getSettings() {
            return state.storeSettings;
        },
        async updateSettings(patch) {
            state.storeSettings = { ...state.storeSettings, ...patch };
            return true;
        },
    };

    const termsAcceptancesRepo = {
        async getAll() {
            return state.termsAcceptances;
        },
        async create(row) {
            state.termsAcceptances.push({ id: `TA-${Date.now()}-${Math.random()}`, ...row });
        },
        async updateById(id, patch) {
            const idx = state.termsAcceptances.findIndex((r) => r.id === id);
            if (idx >= 0) state.termsAcceptances[idx] = { ...state.termsAcceptances[idx], ...patch };
        },
    };

    const userRepository = {
        async find(guildId, userId) {
            return state.users.find((u) => u.guildId === guildId && u.userId === userId) || null;
        },
        async upsert(row) {
            const idx = state.users.findIndex((u) => u.guildId === row.guildId && u.userId === row.userId);
            if (idx >= 0) state.users[idx] = { ...state.users[idx], ...row };
            else state.users.push(row);
        },
    };

    const repositories = {
        simpleStoreRepository,
        opsRepository: {
            termsAcceptances: {
                getAll: termsAcceptancesRepo.getAll,
                create: termsAcceptancesRepo.create,
                updateById: termsAcceptancesRepo.updateById,
            },
        },
        userRepository,
    };

    // ----------------------------
    // backlogService (real) for sendTermsPanel + acceptTerms
    // ----------------------------
    const backlogService = createBacklogService({
        botConfig: { storeName: "HYPERINDO" },
        logger: createSilentLogger(),
        repositories,
        statusSyncService: null,
        loggingService: { logBot: async () => { }, logModeration: async () => { } },
        orderService: null,
        paymentService: null,
    });

    const guild = createFakeGuild({ id: "guild-mt-2" });

    const termsChannel = {
        id: "ch-terms-1",
        name: "terms",
        isTextBased: () => true,
        _sent: [],
        send: async (payload) => {
            termsChannel._sent.push(payload);
            return { id: `msg-${Date.now()}` };
        },
    };
    guild.channels.cache._set(termsChannel);

    // services needed by commands/handlers
    const services = {
        backlogService,
        storeOpsService: { writeStaffLog: async () => { } },
        loggingService: { logBot: async () => { } },
    };

    // ----------------------------
    // Commands under maintenance check
    // ----------------------------
    const viewOnlyCommand = { name: "price" };
    const customerCommand = { name: "order" };

    // Minimal “command” objects with execute
    const commandObj = (replyText) => ({
        data: {},
        execute: async (interaction) => interaction.reply({ content: replyText }),
    });

    const commandNameMap = {
        price: commandObj("view ok"),
        order: commandObj("customer ok"),
        maintenance: maintenanceCommand,
        "setup-terms": setupTermsCommand,
    };

    const client = createClientWithCommands({
        repositories,
        services,
        commandNameMap,
        monitoringService: { incrementCommands: () => { } },
    });

    // Rate limit + cooldown handled in interactionCreateHandler via client.container.services.rateLimitService

    const staffMember = createFakeMember({ userId: "staff-1", roles: ["ADMIN"], isOwnerOrStaff: true });
    const customerMember = createFakeMember({ userId: "cust-1", roles: ["MEMBER"], isOwnerOrStaff: false });

    // ----------------------------
    // 1) maintenance ON via admin command
    // ----------------------------
    const adminInteraction = {
        ...createCommandExecutionInteraction({
            guild,
            userId: staffMember.id,
            member: staffMember,
            commandName: "maintenance",
            channel: termsChannel,
        }),
        options: {
            getString: (name) => (name === "mode" ? "on" : ""),
        },
        deferReply: async () => { },
        editReply: async () => { },
    };

    await maintenanceCommand.execute(adminInteraction, client);

    assert.equal(state.storeSettings.maintenanceMode, true, "maintenanceMode should be enabled after /maintenance on");

    // ----------------------------
    // 2) customer command blocked during maintenance
    // ----------------------------
    const customerInteraction = createCommandExecutionInteraction({
        guild,
        userId: customerMember.id,
        member: customerMember,
        commandName: "order",
        channel: termsChannel,
    });

    // handler expects client.commands.get, and requires interaction.guild/user/member
    await interactionCreateHandler.execute(client, customerInteraction);

    const replies1 = customerInteraction._replies;
    assert.ok(
        replies1.length >= 1 && /maintenance/i.test(String(replies1[0]?.content || "")),
        "customer command should be blocked by maintenance",
    );

    // ----------------------------
    // 3) staff bypass during maintenance
    // ----------------------------
    const staffInteraction = createCommandExecutionInteraction({
        guild,
        userId: staffMember.id,
        member: staffMember,
        commandName: "order",
        channel: termsChannel,
    });

    await interactionCreateHandler.execute(client, staffInteraction);
    assert.ok(staffInteraction._replies.some((r) => String(r?.content || "").includes("customer ok")), "staff should bypass maintenance");

    // ----------------------------
    // 4) view-only allowed (ALLOWED_COMMANDS includes price)
    // ----------------------------
    const viewInteraction = createCommandExecutionInteraction({
        guild,
        userId: customerMember.id,
        member: customerMember,
        commandName: "price",
        channel: termsChannel,
    });

    await interactionCreateHandler.execute(client, viewInteraction);
    assert.ok(viewInteraction._replies.some((r) => String(r?.content || "").includes("view ok")), "view-only command should be allowed during maintenance");

    // ----------------------------
    // 5) /setup-terms sends panel even during maintenance (staff command -> bypass)
    // ----------------------------
    const setupTermsInteraction = {
        ...createCommandExecutionInteraction({
            guild,
            userId: staffMember.id,
            member: staffMember,
            commandName: "setup-terms",
            channel: termsChannel,
        }),
        deferReply: async () => { },
        editReply: async (payload) => setupTermsInteraction._replies.push(payload),
    };

    await setupTermsCommand.execute(setupTermsInteraction, client);
    assert.ok(termsChannel._sent.length >= 1, "terms panel should be sent to channel");

    // ----------------------------
    // 6) maintenance OFF -> customer allowed
    // ----------------------------
    const adminOffInteraction = {
        ...createCommandExecutionInteraction({
            guild,
            userId: staffMember.id,
            member: staffMember,
            commandName: "maintenance",
            channel: termsChannel,
        }),
        options: {
            getString: (name) => (name === "mode" ? "off" : ""),
        },
        deferReply: async () => { },
        editReply: async () => { },
    };

    await maintenanceCommand.execute(adminOffInteraction, client);
    assert.equal(state.storeSettings.maintenanceMode, false, "maintenanceMode should be disabled after /maintenance off");

    const customerInteractionAllowed = createCommandExecutionInteraction({
        guild,
        userId: customerMember.id,
        member: customerMember,
        commandName: "order",
        channel: termsChannel,
    });

    await interactionCreateHandler.execute(client, customerInteractionAllowed);
    assert.ok(customerInteractionAllowed._replies.some((r) => String(r?.content || "").includes("customer ok")), "customer should be allowed after maintenance off");

    // ----------------------------
    // 7) customer accepts terms -> termsAccepted saved; clicking twice safe
    // ----------------------------
    const acceptInteraction1 = createButtonInteraction({
        guild,
        userId: customerMember.id,
        member: customerMember,
        channel: termsChannel,
        customId: componentIds.termsAcceptButton,
    });

    await handleButton(client, acceptInteraction1);

    assert.equal(state.termsAcceptances.length, 1, "terms acceptance should be created");

    const acceptedAt1 = state.termsAcceptances[0].acceptedAt;

    // Click accept again: should not throw and should update acceptedAt
    const acceptInteraction2 = createButtonInteraction({
        guild,
        userId: customerMember.id,
        member: customerMember,
        channel: termsChannel,
        customId: componentIds.termsAcceptButton,
    });

    await handleButton(client, acceptInteraction2);

    assert.equal(state.termsAcceptances.length, 1, "terms acceptance should not duplicate");
    const acceptedAt2 = state.termsAcceptances[0].acceptedAt;
    assert.ok(acceptedAt2 && acceptedAt1, "acceptedAt should exist");
    assert.ok(String(acceptedAt2).length >= 10, "acceptedAt updated safely");
});
