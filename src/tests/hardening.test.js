const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createDatabase } = require("../database/connection");
const { loadCommands } = require("../handlers/commandHandler");
const voiceStateUpdateEvent = require("../events/guild/voiceStateUpdate");

function createTempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-test-"));
  return {
    root,
    storage: {
      root: path.join(root, "storage"),
      backups: path.join(root, "storage", "backups"),
      transcripts: path.join(root, "storage", "transcripts"),
      temp: path.join(root, "storage", "temp"),
    },
  };
}

function createLoggerCapture() {
  const logs = [];
  return {
    logs,
    logger: {
      info(message, extra) {
        logs.push({ level: "info", message, extra });
      },
      warn(message, extra) {
        logs.push({ level: "warn", message, extra });
      },
      error(message, extra) {
        logs.push({ level: "error", message, extra });
      },
    },
  };
}

test("database write uses atomic tmp+backup flow", async () => {
  const paths = createTempPaths();
  const { logger } = createLoggerCapture();
  const database = createDatabase(paths, logger);
  database.init();

  await database.write("tickets", [{ id: "T-1" }]);
  const target = database.files.tickets;
  const backup = `${target}.bak`;
  const tmp = `${target}.tmp`;

  assert.equal(fs.existsSync(target), true);
  assert.equal(fs.existsSync(tmp), false);
  assert.equal(fs.existsSync(backup), true);

  await database.write("tickets", [{ id: "T-2" }]);
  const current = JSON.parse(fs.readFileSync(target, "utf8"));
  assert.equal(fs.existsSync(backup), true);
  const previous = JSON.parse(fs.readFileSync(backup, "utf8"));

  assert.equal(current[0].id, "T-2");
  assert.equal(previous[0].id, "T-1");
});

test("voiceStateUpdate handler catches music cleanup errors", async () => {
  const captured = createLoggerCapture();
  const client = {
    container: {
      logger: captured.logger,
      services: {
        musicService: {
          async handleVoiceStateUpdate() {
            throw new Error("cleanup failed");
          },
        },
      },
    },
  };

  const oldState = {
    guild: { id: "guild-1" },
    channelId: "voice-1",
  };

  await voiceStateUpdateEvent.execute(client, oldState);

  const errorLog = captured.logs.find((entry) => entry.level === "error" && entry.message === "voice state update failed");
  assert.ok(errorLog);
  assert.equal(errorLog.extra.guildId, "guild-1");
});

test("command loader logs invalid command files but still loads valid ones", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-cmd-"));
  const validPath = path.join(tempDir, "valid.js");
  const invalidPath = path.join(tempDir, "invalid.js");

  fs.writeFileSync(
    validPath,
    "module.exports = { data: { name: 'valid', setDMPermission() {} }, async execute() {} };",
    "utf8",
  );
  fs.writeFileSync(invalidPath, "module.exports = { nope: true };", "utf8");

  const captured = createLoggerCapture();
  const commands = loadCommands(tempDir, captured.logger);

  assert.equal(commands.length, 1);
  assert.equal(commands[0].data.name, "valid");
  assert.ok(captured.logs.some((entry) => entry.level === "warn" && entry.message === "command file ignored: invalid shape"));
});
