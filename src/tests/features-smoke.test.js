const test = require("node:test");
const assert = require("node:assert/strict");

function createRoleCache(roleNames = []) {
  return {
    some(callback) {
      return roleNames.some((roleName) => callback({ name: roleName, id: roleName }));
    },
    has(roleId) {
      return roleNames.includes(roleId);
    },
  };
}

function createInteraction({
  roleNames = ["OWNER", "STAFF", "MEMBER", "DJ"],
  options = {},
  guildChannels = [],
} = {}) {
  const replies = [];
  const edits = [];
  const followUps = [];
  const sentMessages = [];

  const channel = {
    id: "channel-1",
    send: async (payload) => {
      sentMessages.push(payload);
      return { id: "message-1" };
    },
    isTextBased() {
      return true;
    },
  };

  const guild = {
    id: "guild-1",
    name: "Guild One",
    channels: {
      cache: {
        find(predicate) {
          return guildChannels.find(predicate) || null;
        },
        get(id) {
          return guildChannels.find((entry) => entry.id === id) || null;
        },
      },
    },
  };

  const member = {
    id: "member-1",
    user: { id: "user-1", tag: "user#0001", username: "user" },
    permissions: {
      has() {
        return true;
      },
    },
    roles: {
      cache: createRoleCache(roleNames),
    },
    voice: {
      channelId: "voice-1",
      channel: { id: "voice-1" },
    },
  };

  const interaction = {
    id: "interaction-1",
    guildId: guild.id,
    channelId: channel.id,
    guild,
    channel,
    member,
    user: member.user,
    options: {
      getString(name, required = false) {
        const value = options[name];
        if ((value === undefined || value === null) && required) {
          throw new Error(`Missing string option: ${name}`);
        }
        return value ?? null;
      },
      getInteger(name, required = false) {
        const value = options[name];
        if ((value === undefined || value === null) && required) {
          throw new Error(`Missing integer option: ${name}`);
        }
        return value ?? null;
      },
      getBoolean(name, required = false) {
        const value = options[name];
        if ((value === undefined || value === null) && required) {
          throw new Error(`Missing boolean option: ${name}`);
        }
        return value ?? null;
      },
    },
    replied: false,
    deferred: false,
    replies,
    edits,
    followUps,
    sentMessages,
    async deferReply() {
      this.deferred = true;
    },
    async reply(payload) {
      this.replied = true;
      replies.push(payload);
    },
    async editReply(payload) {
      edits.push(payload);
    },
    async followUp(payload) {
      followUps.push(payload);
    },
    isChatInputCommand() {
      return true;
    },
  };

  return interaction;
}

function createClient(overrides = {}) {
  const calls = {
    ensureTemplate: 0,
    ensureRoles: 0,
    sendVerifyPanel: 0,
    sendRolePanel: 0,
    sendTicketPanel: 0,
    sendPaymentPanel: 0,
    sendPromoPanel: 0,
    openOrder: 0,
    closeOrder: 0,
    createTicketChannel: 0,
    claimTicket: 0,
    closeTicket: 0,
    requestCloseTicket: 0,
    reopenTicket: 0,
    setOrderStatus: 0,
    startQueue: 0,
    getQueueView: 0,
    enqueue: 0,
    pause: 0,
    createGiveaway: 0,
  };

  const services = {
    structureService: {
      async ensureTemplate() {
        calls.ensureTemplate += 1;
        return { categories: 3, channels: 12 };
      },
    },
    roleService: {
      async ensureRoles() {
        calls.ensureRoles += 1;
        return { created: ["A"], updated: ["B"] };
      },
    },
    verifyService: {
      async sendVerifyPanel() {
        calls.sendVerifyPanel += 1;
      },
      async sendRolePanel() {
        calls.sendRolePanel += 1;
      },
    },
    ticketService: {
      async sendTicketPanel() {
        calls.sendTicketPanel += 1;
      },
      async createTicketChannel() {
        calls.createTicketChannel += 1;
        return { channel: "<#ticket-1>" };
      },
      async claimTicket() {
        calls.claimTicket += 1;
        return { id: "0001" };
      },
      async closeTicket() {
        calls.closeTicket += 1;
        return { id: "0001" };
      },
      async requestCloseTicket() {
        calls.requestCloseTicket += 1;
        return { id: "0001" };
      },
      async reopenTicket() {
        calls.reopenTicket += 1;
        return { channel: "<#ticket-1>" };
      },
    },
    paymentService: {
      async sendPaymentPanel() {
        calls.sendPaymentPanel += 1;
      },
      async sendPromoPanel() {
        calls.sendPromoPanel += 1;
      },
    },
    orderService: {
      async openOrder() {
        calls.openOrder += 1;
        return { channel: "<#order-1>", reused: false };
      },
      async closeOrder() {
        calls.closeOrder += 1;
        return { ok: true };
      },
      async setOrderStatus() {
        calls.setOrderStatus += 1;
        return { ok: true, message: "ok" };
      },
    },
    jokiService: {
      async startQueue() {
        calls.startQueue += 1;
        return { entry: { id: "JOKI-1", position: 0 } };
      },
      async getQueueView() {
        calls.getQueueView += 1;
        return { active: null, entries: [] };
      },
      buildQueueEmbed() {
        return { title: "embed" };
      },
    },
    musicService: {
      async enqueue() {
        calls.enqueue += 1;
        return { track: { title: "Track 1", source: "youtube" } };
      },
      getQueue() {
        return { voiceChannelId: "voice-1", current: null, tracks: [] };
      },
      pause() {
        calls.pause += 1;
        return true;
      },
    },
    funService: {
      async createGiveaway() {
        calls.createGiveaway += 1;
      },
    },
  };

  const client = {
    container: {
      logger: {
        info() { },
        warn() { },
        error() { },
      },
      services: { ...services, ...(overrides.services || {}) },
    },
  };

  return { client, calls };
}

test("feature smoke: setup-gamestore", async () => {
  const command = require("../commands/setup/setupGamestore");
  const verifyChannel = { id: "c-verify", name: "verify", isTextBased() { return true; } };
  const roleChannel = { id: "c-role", name: "role-select", isTextBased() { return true; } };
  const ticketChannel = { id: "c-ticket", name: "open-ticket", isTextBased() { return true; } };
  const paymentChannel = { id: "c-payment", name: "payment-info", isTextBased() { return true; } };
  const promoChannel = { id: "c-promo", name: "promo", isTextBased() { return true; } };
  const interaction = createInteraction({ guildChannels: [verifyChannel, roleChannel, ticketChannel, paymentChannel, promoChannel] });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.ensureTemplate, 1);
  assert.equal(calls.sendVerifyPanel, 1);
  assert.equal(calls.sendRolePanel, 1);
  assert.equal(calls.sendTicketPanel, 1);
  assert.equal(calls.sendPaymentPanel, 1);
  assert.equal(calls.sendPromoPanel, 1);
});

test("feature smoke: setup-basic", async () => {
  const command = require("../commands/setup/setupBasic");
  const interaction = createInteraction({ options: { template: "basic" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.ensureTemplate, 1);
});

test("feature smoke: setup-roles", async () => {
  const command = require("../commands/setup/setupRoles");
  const interaction = createInteraction();
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.ensureRoles, 1);
});

test("feature smoke: send-verify-panel", async () => {
  const command = require("../commands/setup/sendVerifyPanel");
  const interaction = createInteraction();
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.sendVerifyPanel, 1);
});

test("feature smoke: send-role-panel", async () => {
  const command = require("../commands/setup/sendRolePanel");
  const interaction = createInteraction();
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.sendRolePanel, 1);
});

test("feature smoke: send-ticket-panel", async () => {
  const command = require("../commands/setup/sendTicketPanel");
  const interaction = createInteraction();
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.sendTicketPanel, 1);
});

test("feature smoke: send-payment-panel", async () => {
  const command = require("../commands/setup/sendPaymentPanel");
  const interaction = createInteraction();
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.sendPaymentPanel, 1);
});

test("feature smoke: send-promo-panel", async () => {
  const command = require("../commands/setup/sendPromoPanel");
  const interaction = createInteraction({ options: { judul: "Promo", isi: "Diskon 10%" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.sendPromoPanel, 1);
});

test("feature smoke: open-order", async () => {
  const command = require("../commands/store/openOrder");
  const interaction = createInteraction({ options: { detail: "Order GTA" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.openOrder, 1);
});

test("feature smoke: close-order", async () => {
  const command = require("../commands/store/closeOrder");
  const interaction = createInteraction({ options: { final_status: "completed" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.closeOrder, 1);
});

test("feature smoke: warranty-claim", async () => {
  const command = require("../commands/store/warrantyClaim");
  const interaction = createInteraction({ options: { issue: "Produk error" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.createTicketChannel, 1);
});

test("feature smoke: claim-ticket", async () => {
  const command = require("../commands/ticket/claimTicket");
  const interaction = createInteraction();
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.claimTicket, 1);
});

test("feature smoke: close-ticket", async () => {
  const command = require("../commands/ticket/closeTicket");
  const interaction = createInteraction({ options: { reason: "Selesai" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.requestCloseTicket, 1);
});

test("feature smoke: reopen-ticket", async () => {
  const command = require("../commands/ticket/reopenTicket");
  const interaction = createInteraction({ options: { ticket_id: "0001" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.reopenTicket, 1);
});

test("feature smoke: set-order-status", async () => {
  const command = require("../commands/ticket/setOrderStatus");
  const interaction = createInteraction({ options: { status: "paid" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.setOrderStatus, 1);
});

test("feature smoke: joki-queue", async () => {
  const command = require("../commands/joki/jokiQueue");
  const interaction = createInteraction({ options: { estimated_minutes: 30, ticket_id: "TKT-1" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.startQueue, 1);
  assert.equal(calls.getQueueView, 1);
});

test("feature smoke: joki-status", async () => {
  const command = require("../commands/joki/jokiStatus");
  const interaction = createInteraction();
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.getQueueView, 1);
});

test("feature smoke: play", async () => {
  const command = require("../commands/music/play");
  const interaction = createInteraction({ options: { query: "never gonna give you up" } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.enqueue, 1);
});

test("feature smoke: pause", async () => {
  const command = require("../commands/music/pause");
  const interaction = createInteraction();
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.pause, 1);
});

test("feature smoke: giveaway", async () => {
  const command = require("../commands/fun/giveaway");
  const interaction = createInteraction({ options: { prize: "Nitro", duration: 10, winners: 1 } });
  const { client, calls } = createClient();
  await command.execute(interaction, client);
  assert.equal(calls.createGiveaway, 1);
});
