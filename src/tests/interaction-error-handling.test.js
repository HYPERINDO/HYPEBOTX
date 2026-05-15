const test = require("node:test");
const assert = require("node:assert/strict");

const interactionCreateEvent = require("../events/interaction/interactionCreate");

function createClient(commandExecute) {
  return {
    commands: new Map([
      ["test-command", { execute: commandExecute }],
    ]),
    cooldowns: new Map(),
    container: {
      logger: {
        info() { },
        warn() { },
        error() { },
      },
      services: {
        rateLimitService: {
          checkInteraction: async () => ({ allowed: true })
        },
        monitoringService: {
          incrementCommands: () => {}
        }
      },
      botConfig: {},
    },
  };
}

function createInteraction() {
  const replies = [];

  return {
    commandName: "test-command",
    channelId: "1488330502950879303",
    guild: { id: "guild-1" },
    channel: { id: "1488330502950879303" },
    user: { id: "user-1" },
    member: { user: { id: "user-1" } },
    replied: false,
    deferred: false,
    replies,
    async reply(payload) {
      this.replied = true;
      replies.push(payload);
    },
    async followUp(payload) {
      replies.push(payload);
    },
    isChatInputCommand() {
      return true;
    },
  };
}

test("interaction handler returns actionable message on missing permissions", async () => {
  const missingPermissionsError = new Error("Missing Permissions");
  missingPermissionsError.code = 50013;

  const interaction = createInteraction();
  const client = createClient(async () => {
    throw missingPermissionsError;
  });

  await interactionCreateEvent.execute(client, interaction);

  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /Bot tidak punya izin/);
  assert.match(interaction.replies[0].content, /View Channel/);
  assert.match(interaction.replies[0].content, /Send Messages/);
});

test("interaction handler keeps generic error message for non-permission errors", async () => {
  const interaction = createInteraction();
  const client = createClient(async () => {
    throw new Error("boom");
  });

  await interactionCreateEvent.execute(client, interaction);

  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /Terjadi error saat memproses permintaan/);
});

test("interaction handler applies per-command cooldown for non-staff users", async () => {
  const interaction = createInteraction();
  const client = createClient(async () => null);

  await interactionCreateEvent.execute(client, interaction);
  assert.equal(interaction.replies.length, 0);

  const secondInteraction = createInteraction();
  await interactionCreateEvent.execute(client, secondInteraction);

  assert.equal(secondInteraction.replies.length, 1);
  assert.match(secondInteraction.replies[0].content, /Terlalu cepat/);
});
