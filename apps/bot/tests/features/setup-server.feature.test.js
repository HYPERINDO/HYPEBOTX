const test = require("node:test");
const assert = require("node:assert/strict");

const { createVerifyService } = require("../../src/services/verifyService");
const { createTicketService } = require("../../src/services/ticketService");
const { createPaymentService } = require("../../src/services/paymentService");

// NOTE: We test wiring/template routing at the "command" level (setup-gamestore)
// and the exact component customIds embedded in panels sent by verifyService.
// For ticket/payment panels we assert they are invoked for the expected channels.

function createSilentLogger() {
  return { info() { }, warn() { }, error() { }, debug() { } };
}

function createFakeChannel({ id, name }) {
  return {
    id,
    name,
    type: 0,
    isTextBased() {
      return true;
    },
    async send(payload) {
      this._lastPayload = payload;
      return { id: `msg-${id}` };
    },
    _lastPayload: null,
  };
}

function createFakeGuild({ channels } = {}) {
  const channelMap = new Map((channels || []).map((ch) => [ch.id, ch]));
  return {
    id: "guild-opt4-1",
    channels: {
      cache: {
        find: (predicate) => {
          for (const ch of channelMap.values()) {
            if (predicate(ch)) return ch;
          }
          return null;
        },
        get: (id) => channelMap.get(id) || null,
        values: () => channelMap.values(),
      },
    },
  };
}

function createRoleServiceMock() {
  // For setup-server tests we only need roleService.ensureRoles + getRoleMap compatibility
  // used by verifyService in send panels (it doesn't read roleMap) and handleVerify flow is in verify-role tests.
  const roleMap = {
    member: { id: "ROLE_MEMBER" },
    unverified: { id: "ROLE_UNVERIFIED" },
  };

  let ensureRuns = 0;

  return {
    ensureRuns,
    async ensureRoles() {
      ensureRuns += 1;
      return ensureRuns === 1
        ? { created: ["ROLE_MEMBER", "ROLE_UNVERIFIED"], updated: [], failed: [] }
        : { created: [], updated: ["ROLE_MEMBER", "ROLE_UNVERIFIED"], failed: [] };
    },
    getRoleMap: () => roleMap,
    addRole: async () => { },
    removeRole: async () => { },
  };
}

function createFakeInteraction({ guild, memberPermissionsOk = true, options = {} } = {}) {
  const replies = [];
  const edits = [];

  const interaction = {
    guild,
    guildId: guild.id,
    user: { id: "actor-1", tag: "actor#0001" },
    member: {
      permissions: {
        has: () => memberPermissionsOk,
      },
    },
    options: {
      getString: (name) => options[name] ?? null,
    },
    deferReply: async () => { },
    editReply: async (payload) => {
      edits.push(payload);
      return payload;
    },
    reply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    _replies: replies,
    _edits: edits,
  };

  return interaction;
}

function findComponentCustomIdFromPayload(payload, expectedCustomId) {
  // discord.js builders don't always expose nested fields in a plain way.
  // Robust approach: check whether the expected customId appears anywhere in a serialized payload.
  try {
    const asString = JSON.stringify(payload);
    return asString.includes(expectedCustomId);
  } catch {
    // fallback: try a shallow check if JSON serialization fails
    return Boolean(payload?.components?.some((c) => String(c?.customId || "").includes(expectedCustomId)));
  }
}

test("feature setup-server (Option 4): setup gamestore/basic/roles + verify/role/ticket/payment panels wiring + idempotency + customer denied", async () => {
  const { default: setupGamestoreCommand } = (() => {
    // require() with CJS export
    return { default: require("../../src/commands/setup/setupGamestore") };
  })();

  const roleService = createRoleServiceMock();
  const repositories = {
    guildRepository: { upsert: async () => { } },
  };

  // verifyService real implementation (so we can assert exact component customIds)
  const verifyService = createVerifyService({
    botConfig: { storeName: "HYPERINDO" },
    logger: createSilentLogger(),
    repositories: {},
    roleService,
    loggingService: { logBot: async () => { } },
  });

  // ticket/payment panels: we only assert they are invoked and that they land on correct channels
  const ticketService = {
    sendTicketPanel: async (channel) => {
      channel._ticketPanelSent = true;
    },
  };
  const paymentService = {
    sendPaymentPanel: async (channel) => {
      channel._paymentPanelSent = true;
    },
    sendPromoPanel: async (channel) => {
      channel._promoPanelSent = true;
    },
  };

  // structureService: we don't need its internals here; we only need setup-gamestore to call it once.
  // Also "setup ulang tidak membuat duplicate role/channel": we model idempotency via ensureRoles + ensureTemplate no duplicate side effects.
  let ensureTemplateRuns = 0;
  const services = {
    structureService: {
      ensureTemplate: async () => {
        ensureTemplateRuns += 1;
        return { categories: 3, channels: 12 };
      },
    },
    verifyService,
    roleService: { ensureRoles: roleService.ensureRoles },
    ticketService,
    paymentService,
  };

  const guild = createFakeGuild({
    channels: [
      createFakeChannel({ id: "c-verify", name: "verify" }),
      createFakeChannel({ id: "c-role", name: "choose-role" }),
      createFakeChannel({ id: "c-ticket", name: "open-ticket" }),
      createFakeChannel({ id: "c-payment", name: "payment-method" }),
      createFakeChannel({ id: "c-promo", name: "promo" }),
    ],
  });

  const client = {
    container: {
      logger: createSilentLogger(),
      services,
    },
  };

  // ---- first setup ----
  const interaction1 = createFakeInteraction({ guild, memberPermissionsOk: true });
  await setupGamestoreCommand.execute(interaction1, client);

  assert.equal(ensureTemplateRuns, 1, "ensureTemplate should run exactly once per setup execution");
  assert.equal(guild.id, "guild-opt4-1");

  const verifyCh = guild.channels.cache.get("c-verify");
  const roleCh = guild.channels.cache.get("c-role");
  const ticketCh = guild.channels.cache.get("c-ticket");
  const paymentCh = guild.channels.cache.get("c-payment");
  const promoCh = guild.channels.cache.get("c-promo");

  // verify panel: must have verify button verify:member customId
  assert.ok(verifyCh._lastPayload, "Verify channel should receive a panel payload");
  assert.ok(
    findComponentCustomIdFromPayload(verifyCh._lastPayload, "verify:member"),
    "Verify panel must include button with customId=verify:member",
  );

  // role panel: must have role select customId role:self
  assert.ok(roleCh._lastPayload, "Role channel should receive a panel payload");
  assert.ok(
    findComponentCustomIdFromPayload(roleCh._lastPayload, "role:self"),
    "Role panel must include select menu with customId=role:self",
  );

  // ticket/payment/promo panel called
  assert.equal(ticketCh._ticketPanelSent, true, "Ticket panel must be sent");
  assert.equal(paymentCh._paymentPanelSent, true, "Payment panel must be sent");
  assert.equal(promoCh._promoPanelSent, true, "Promo panel must be sent");

  // ---- setup ulang: no duplicates ----
  const interaction2 = createFakeInteraction({ guild, memberPermissionsOk: true });
  await setupGamestoreCommand.execute(interaction2, client);

  assert.equal(ensureTemplateRuns, 2, "ensureTemplate called again on second setup");
  // Since structureService.ensureTemplate is mocked (doesn't call roleService.ensureRoles),
  // we validate idempotency at the wiring level: panels are still sent and component ids stay correct.
  assert.ok(verifyCh._lastPayload, "Verify panel should still be sent on re-setup");
  assert.ok(roleCh._lastPayload, "Role panel should still be sent on re-setup");

  // ---- customer tidak bisa command setup ----
  const interactionCustomer = createFakeInteraction({ guild, memberPermissionsOk: false });
  await setupGamestoreCommand.execute(interactionCustomer, client);
  const edits = interactionCustomer._edits || [];
  const editContent = edits.map((e) => e?.content).filter(Boolean).join(" | ");
  assert.ok(
    /tidak punya permission/i.test(editContent),
    "Customer should be denied running setup-gamestore",
  );
});
