const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canAccessPanel,
  canRunAction,
  customId,
  handlePanelButton,
  handlePanelModal,
  handlePanelSelect,
  maskSensitiveData,
} = require("../services/panelService");
const {
  filterCommandsForRegistration,
  PANEL_COMMAND_NAMES,
  toUniqueCommandJson,
} = require("../handlers/commandHandler");

function createMember(roleNames = [], options = {}) {
  const roles = roleNames.map((name) => ({ name, id: name }));
  return {
    id: options.id || "user-1",
    guild: { ownerId: options.ownerId || "owner-1" },
    permissions: {
      has(permission) {
        return Boolean(options.adminPermission) || String(permission) === "8n";
      },
    },
    roles: {
      cache: {
        has(name) {
          return roleNames.includes(name);
        },
        values() {
          return roles;
        },
      },
    },
  };
}

function createInteraction(overrides = {}) {
  const replies = [];
  const modals = [];
  const edits = [];
  const interaction = {
    customId: overrides.customId || customId("button", "open:customer"),
    values: overrides.values || [],
    guild: { id: "guild-1" },
    channel: { id: "channel-1" },
    user: { id: "user-1", tag: "user#0001" },
    member: overrides.member || createMember(["MEMBER"]),
    client: {
      container: {
        logger: { info() {}, warn() {}, error() {} },
        services: {
          loggingService: {
            async logAdminAction() {},
          },
          orderService: {
            async startCheckoutFromPanel() {
              return { reused: false };
            },
          },
          ticketService: {
            async createTicketChannel() {
              return { channel: "<#ticket-1>", reused: false };
            },
          },
        },
        repositories: {
          orderRepository: {
            async findByUserId() {
              return [];
            },
          },
        },
      },
    },
    fields: {
      getTextInputValue(id) {
        return id === "reason" ? "maintenance terjadwal" : "";
      },
    },
    replied: false,
    deferred: false,
    replies,
    modals,
    edits,
    async reply(payload) {
      this.replied = true;
      replies.push(payload);
      return payload;
    },
    async deferReply() {
      this.deferred = true;
    },
    async editReply(payload) {
      edits.push(payload);
      return payload;
    },
    async showModal(modal) {
      modals.push(modal);
      return modal;
    },
  };
  interaction.client.container.repositories = interaction.client.container.repositories;
  return interaction;
}

test("panel role guard allows owner everywhere and blocks customer from admin/owner/dev", () => {
  const owner = createMember(["OWNER"]);
  const customer = createMember(["MEMBER"]);

  assert.equal(canAccessPanel(owner, "owner"), true);
  assert.equal(canAccessPanel(owner, "dev"), true);
  assert.equal(canAccessPanel(customer, "customer"), true);
  assert.equal(canAccessPanel(customer, "admin"), false);
  assert.equal(canAccessPanel(customer, "owner"), false);
  assert.equal(canAccessPanel(customer, "dev"), false);
});

test("dangerous action guard blocks admin from owner restore and allows owner", () => {
  const admin = createMember(["ADMIN"]);
  const owner = createMember(["OWNER"]);

  assert.equal(canRunAction(admin, "owner:backup-restore"), false);
  assert.equal(canRunAction(owner, "owner:backup-restore"), true);
  assert.equal(canRunAction(admin, "order:refund"), true);
});

test("maskSensitiveData redacts env, tokens, webhooks, and valueencr", () => {
  const masked = maskSensitiveData([
    "DISCORD_TOKEN=abc123",
    "OPENAI_API_KEY=sk-test",
    "password: rahasia",
    "valueencr=license-key",
    "https://discord.com/api/webhooks/1/secret",
  ].join("\n"));

  assert.doesNotMatch(masked, /abc123|sk-test|rahasia|license-key|\/1\/secret/);
  assert.match(masked, /\[MASKED\]/);
});

test("customer order panel button starts checkout through existing order service", async () => {
  const interaction = createInteraction({
    customId: customId("button", "customer:order"),
  });

  const result = await handlePanelButton(interaction.client, interaction);

  assert.deepEqual(result, { reused: false });
  assert.equal(interaction.deferred, true);
  assert.equal(interaction.edits.length, 1);
  assert.match(String(interaction.edits[0]), /Panel checkout dikirim/);
});

test("dangerous select opens reason modal", async () => {
  const interaction = createInteraction({
    customId: customId("select", "admin:order"),
    values: ["order:refund"],
    member: createMember(["ADMIN"]),
  });

  await handlePanelSelect(interaction.client, interaction);

  assert.equal(interaction.modals.length, 1);
  assert.match(interaction.modals[0].data.custom_id, /order:refund$/);
});

test("dangerous modal returns confirmation payload", async () => {
  const interaction = createInteraction({
    customId: customId("reason", "order:refund"),
    member: createMember(["ADMIN"]),
  });

  await handlePanelModal(interaction.client, interaction);

  assert.equal(interaction.replies.length, 1);
  const payload = interaction.replies[0];
  assert.match(payload.embeds[0].data.title, /WARNING/);
  assert.equal(payload.components.length, 1);
});

test("slash command panel mode only registers panel entrypoints", () => {
  const commands = [
    "panel",
    "admin",
    "owner",
    "dev",
    "setup-panel",
    "sync-panel",
    "order",
    "stock-add",
    "paymentcheck",
  ].map((name) => ({
    data: {
      name,
      toJSON() {
        return { name };
      },
    },
  }));

  const filtered = filterCommandsForRegistration(commands, "panel");
  const names = toUniqueCommandJson(filtered).map((command) => command.name).sort();

  assert.deepEqual(names, [...PANEL_COMMAND_NAMES].sort());
  assert.equal(names.length, 6);
});
