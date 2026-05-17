const { REST, Routes } = require("discord.js");
const botConfig = require("../config/bot");
const {
  filterCommandsForRegistration,
  getSlashCommandMode,
  loadCommands,
  toUniqueCommandJson,
} = require("../handlers/commandHandler");
const path = require("path");
const { createLogger } = require("../utils/logger");

const log = createLogger("deploy-commands");

async function deployCommands() {
  const commandsBaseDir = path.join(__dirname, "..", "commands");
  const loaded = loadCommands(commandsBaseDir);
  const slashCommandMode = getSlashCommandMode();
  const commands = toUniqueCommandJson(filterCommandsForRegistration(loaded, slashCommandMode));

  const rest = new REST({ version: "10" }).setToken(botConfig.token);

  if (botConfig.guildId) {
    await rest.put(Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId), {
      body: commands,
    });
    log.info(`Guild commands deployed: ${commands.length}`, { slashCommandMode });
    return;
  }

  await rest.put(Routes.applicationCommands(botConfig.clientId), { body: commands });
  log.info(`Global commands deployed: ${commands.length}`, { slashCommandMode });
}

deployCommands().catch((error) => {
  log.error("Failed to deploy commands", { error: error.message });
  process.exit(1);
});
