const { REST, Routes } = require("discord.js");
const botConfig = require("../config/bot");
const { loadCommands } = require("../handlers/commandHandler");
const path = require("path");
const { createLogger } = require("../utils/logger");

const log = createLogger("deploy-commands");

async function deployCommands() {
  const commandsBaseDir = path.join(__dirname, "..", "commands");
  const loaded = loadCommands(commandsBaseDir);

  // Deploy scope:
  // - default/full: semua command aktif
  // - legacy_minimal: kompatibilitas mode lama (hanya subset non-setup/admin-utilities)
  const deployScope = String(process.env.DEPLOY_COMMAND_SCOPE || "full").trim().toLowerCase();
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
  const keepAdminNames = new Set(["maintenance", "health", "audit", "export", "guide", "note"]);

  const filtered = loaded.filter((command) => {
    const cmdName = command?.data?.name;
    if (!cmdName) return false;
    if (deployScope !== "legacy_minimal") return true;

    if (String(command?.__filePath || "").includes(`${path.sep}setup${path.sep}`)) {
      return false;
    }
    if (setupNames.has(cmdName)) return false;
    if (String(command?.__filePath || "").includes(`${path.sep}admin${path.sep}`)) {
      return keepAdminNames.has(cmdName);
    }
    return true;
  });

  // Discord requirement: names must be unique per scope.
  const seen = new Set();
  const commands = filtered
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
    log.info(`Guild commands deployed: ${commands.length}`, { deployScope });
    return;
  }

  await rest.put(Routes.applicationCommands(botConfig.clientId), { body: commands });
  log.info(`Global commands deployed: ${commands.length}`, { deployScope });
}

deployCommands().catch((error) => {
  log.error("Failed to deploy commands", { error: error.message });
  process.exit(1);
});
