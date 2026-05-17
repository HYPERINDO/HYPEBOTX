const { Events } = require("discord.js");
const {
  filterCommandsForRegistration,
  getSlashCommandMode,
  toUniqueCommandJson,
} = require("../../handlers/commandHandler");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client, readyClient) {
    const slashCommandMode = getSlashCommandMode();
    const commands = toUniqueCommandJson(
      filterCommandsForRegistration([...client.commands.values()], slashCommandMode),
    );
    const { botConfig, logger, jobs } = client.container;

    if (botConfig.guildId) {
      const guild = await readyClient.guilds.fetch(botConfig.guildId);
      await guild.commands.set(commands);
      logger.info("guild commands synced", { guildId: guild.id, count: commands.length, slashCommandMode });
    } else {
      await readyClient.application.commands.set(commands);
      logger.info("global commands synced", { count: commands.length, slashCommandMode });
    }

    jobs.autoBackupJob.start(client);
    jobs.autoCloseTicketJob.start(client);
    if (jobs.paymentReminderJob?.start) {
      jobs.paymentReminderJob.start(client);
    }
    if (jobs.jokiQueueJob?.start) {
      jobs.jokiQueueJob.start(client);
    }
    if (jobs.jokiHoldReminderJob?.start) {
      jobs.jokiHoldReminderJob.start(client);
    }
    jobs.giveawayJob.start(client);
    if (jobs.musicCleanupJob?.start) {
      jobs.musicCleanupJob.start(client);
    }
    if (client.container.services?.webDashboardService?.isEnabled?.()) {
      await client.container.services.webDashboardService.start(client).catch((error) => {
        logger.warn("web dashboard server failed to start", { message: error.message });
      });
    }

    logger.info(`ready as ${readyClient.user.tag}`);
  },
};
