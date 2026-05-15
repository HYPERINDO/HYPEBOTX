const { REST, Routes } = require("discord.js");
const botConfig = require("../config/bot");
const { createLogger } = require("../utils/logger");

const log = createLogger("deploy-delete");

async function deleteCommands() {
  const rest = new REST({ version: "10" }).setToken(botConfig.token);

  if (botConfig.guildId) {
    await rest.put(Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId), {
      body: [],
    });
    log.info("Guild commands deleted");
    return;
  }

  await rest.put(Routes.applicationCommands(botConfig.clientId), { body: [] });
  log.info("Global commands deleted");
}

deleteCommands().catch((error) => {
  log.error("Failed to delete commands", { error: error.message });
  process.exit(1);
});
