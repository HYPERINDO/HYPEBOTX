const { Events } = require("discord.js");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client, readyClient) {
    const commands = [...client.commands.values()].map((command) => command.data.toJSON());
    const { botConfig, logger, jobs } = client.container;

    if (botConfig.guildId) {
      const guild = await readyClient.guilds.fetch(botConfig.guildId);
      await guild.commands.set(commands);
      logger.info("guild commands synced", { guildId: guild.id, count: commands.length });
    } else {
      await readyClient.application.commands.set(commands);
      logger.info("global commands synced", { count: commands.length });
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
    if (client.container.services?.backlogService?.startOwnerDashboardServer) {
      await client.container.services.backlogService.startOwnerDashboardServer(client).catch((error) => {
        logger.warn("owner dashboard server failed to start", { message: error.message });
      });
    }

    logger.info(`ready as ${readyClient.user.tag}`);
  },
};
