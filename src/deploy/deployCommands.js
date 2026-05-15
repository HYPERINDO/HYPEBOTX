const { REST, Routes } = require("discord.js");
const botConfig = require("../config/bot");
const { loadCommands } = require("../handlers/commandHandler");
const path = require("path");
const { createLogger } = require("../utils/logger");

const log = createLogger("deploy-commands");

async function deployCommands() {
  const commandsBaseDir = path.join(__dirname, "..", "commands");
  const loaded = loadCommands(commandsBaseDir);

  // Scope penghapusan slash command (admin tidak bergantung slash command):
  // - hapus semua src/commands/setup/*
  // - hapus semua src/commands/admin/*
  // - kecuali command "keep utilities": maintenance + debugging/emergency/owner-dev utilities
  const keepAdminNames = new Set([
    "maintenance",
    "health",
    "audit",
    "export",
    "guide",
    "note",
  ]);

  // Discord requirement: names must be unique per scope
  const seen = new Set();
  const commands = loaded
    .filter((command) => {
      const cmdName = command?.data?.name;
      if (!cmdName) return false;

      // setup commands always removed
      if (String(command?.__filePath || "").includes(`${path.sep}setup${path.sep}`)) {
        return false;
      }

      // fallback: if command loader didn't attach __filePath, infer by command name is not reliable.
      // We'll also exclude all setup-ish names by known set to reduce risk.
      const setupNames = new Set([
        "setup",
        "setup-basic",
        "setup-gamestore",
        "setup-roles",
        "send-verify-panel",
        "send-role-panel",
        "send-ticket-panel",
        "send-payment-panel",
        "send-promo-panel",
        "format",
      ]);
      if (setupNames.has(cmdName)) return false;

      // admin commands: keep only utilities list
      if (String(command?.__filePath || "").includes(`${path.sep}admin${path.sep}`)) {
        return keepAdminNames.has(cmdName);
      }

      return true;
    })
    .map((command) => command.data.toJSON())
    .filter((cmd) => {
      const name = cmd?.name;
      if (!name) return false;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });

  const rest = new REST({ version: "10" }).setToken(botConfig.token);

  if (botConfig.guildId) {
    await rest.put(Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId), {
      body: commands,
    });
    log.info(`Guild commands deployed: ${commands.length}`);
    return;
  }

  await rest.put(Routes.applicationCommands(botConfig.clientId), { body: commands });
  log.info(`Global commands deployed: ${commands.length}`);
}

deployCommands().catch((error) => {
  log.error("Failed to deploy commands", { error: error.message });
  process.exit(1);
});
