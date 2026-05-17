const test = require("node:test");
const assert = require("node:assert/strict");

const { createLoggingService } = require("../services/loggingService");

function createGuildWithBotLogsChannel(id = "guild-1") {
  const sentPayloads = [];
  const channels = [
    {
      name: "bot-logs",
      send: async (payload) => {
        sentPayloads.push(payload);
        return payload;
      },
    },
  ];

  const guild = {
    id,
    channels: {
      cache: {
        find(predicate) {
          return channels.find(predicate) || null;
        },
      },
    },
  };

  return { guild, sentPayloads };
}

function createClientWithGuild(guild) {
  const guildMap = new Map([[guild.id, guild]]);
  return {
    guilds: {
      cache: {
        get(guildId) {
          return guildMap.get(guildId) || null;
        },
        values() {
          return guildMap.values();
        },
      },
    },
  };
}

test("loggingService.logAlert routes runtime alert with null guild when exactly one guild is available", async () => {
  const { guild, sentPayloads } = createGuildWithBotLogsChannel();
  const client = createClientWithGuild(guild);
  const logger = { info() {}, warn() {}, error() {} };
  const service = createLoggingService({ client, logger });

  await service.logAlert({
    type: "HEALTH_CHECK",
    severity: "warning",
    message: "Heap usage high",
    details: { usage: "89%" },
    suppressConsoleLog: true,
  });

  assert.equal(sentPayloads.length, 1);
  assert.equal(Array.isArray(sentPayloads[0].embeds), true);
});

test("loggingService.logEvent uses human datetime format in description", async () => {
  const { guild, sentPayloads } = createGuildWithBotLogsChannel();
  const client = createClientWithGuild(guild);
  const logger = { info() {}, warn() {}, error() {} };
  const service = createLoggingService({ client, logger });

  await service.logEvent(guild, "runtime", "Runtime Event", { phase: "audit" });

  assert.equal(sentPayloads.length, 1);
  const json = sentPayloads[0].embeds[0].toJSON();
  assert.match(json.description, /^Event at \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  assert.equal(json.description.includes("T"), false);
});
