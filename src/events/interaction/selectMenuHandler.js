const { Events, MessageFlags } = require("discord.js");
const { handleSelectMenu } = require("../../handlers/selectMenuHandler");

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (!interaction.isStringSelectMenu()) {
      return;
    }

    const botConfig = require("../../config/bot");
    if (botConfig.allowedGuildIds.length > 0 && !botConfig.allowedGuildIds.includes(interaction.guild.id)) {
      client.container.logger.warn("Select menu interaction from unauthorized guild ignored", { guildId: interaction.guild.id });
      return;
    }

    try {
      await handleSelectMenu(client, interaction);
    } catch (error) {
      client.container.logger.error("select menu interaction failed", {
        customId: interaction.customId,
        message: error.message,
      });

      try {
        const { createFeatureErrorLogger } = require("../../utils/featureErrorLogger");
        const featureErrorLogger = createFeatureErrorLogger({
          logger: client.container.logger,
          loggingService: client.container.services?.loggingService,
          botConfig: client.container.botConfig,
        });

        await featureErrorLogger.capture({
          interaction,
          feature: `selectMenu:${interaction.customId}`,
          error,
        });
      } catch (logError) {
        client.container.logger.error("feature_error_logging_failed", {
          originalError: error?.message,
          logError: logError?.message,
        });
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "Terjadi error saat memproses permintaan. Silakan coba lagi atau hubungi admin.",
          flags: MessageFlags.Ephemeral,
        }).catch((replyError) => {
          client.container.logger.warn("select menu error followUp failed", {
            customId: interaction.customId,
            message: replyError?.message || String(replyError),
          });
        });
      } else {
        await interaction.reply({
          content: "Terjadi error saat memproses permintaan. Silakan coba lagi atau hubungi admin.",
          flags: MessageFlags.Ephemeral,
        }).catch((replyError) => {
          client.container.logger.warn("select menu error reply failed", {
            customId: interaction.customId,
            message: replyError?.message || String(replyError),
          });
        });
      }
    }
  },
};
