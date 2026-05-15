const { Events, MessageFlags } = require("discord.js");
const { handleModal } = require("../../handlers/modalHandler");

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (!interaction.isModalSubmit()) {
      return;
    }

    const botConfig = require("../../config/bot");
    if (botConfig.allowedGuildIds.length > 0 && !botConfig.allowedGuildIds.includes(interaction.guild.id)) {
      client.container.logger.warn("Modal interaction from unauthorized guild ignored", { guildId: interaction.guild.id });
      return;
    }

    try {
      await handleModal(client, interaction);
    } catch (error) {
      client.container.logger.error("modal interaction failed", {
        customId: interaction.customId,
        message: error.message,
      });

      // Jika interaction sudah kedaluwarsa/invalid, reply/followUp akan selalu gagal (10062).
      if (error?.code === 10062) {
        return;
      }

      try {
        const { createFeatureErrorLogger } = require("../../utils/featureErrorLogger");
        const featureErrorLogger = createFeatureErrorLogger({
          logger: client.container.logger,
          loggingService: client.container.services?.loggingService,
          botConfig: client.container.botConfig,
        });

        await featureErrorLogger.capture({
          interaction,
          feature: `modal:${interaction.customId}`,
          error,
        });
      } catch (logError) {
        client.container.logger.error("feature_error_logging_failed", {
          originalError: error?.message,
          logError: logError?.message,
        });
      }

      // Gunakan MessageFlags agar tidak memicu warning: ephemeral deprecated
      const userMessage =
        "❌ Form gagal diproses. Silakan coba isi ulang form, atau hubungi admin jika masih terjadi.";

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: userMessage,
          flags: MessageFlags.Ephemeral,
        }).catch((replyError) => {
          client.container.logger.warn("modal error followUp failed", {
            customId: interaction.customId,
            message: replyError?.message || String(replyError),
          });
        });
      } else {
        await interaction.reply({
          content: userMessage,
          flags: MessageFlags.Ephemeral,
        }).catch((replyError) => {
          client.container.logger.warn("modal error reply failed", {
            customId: interaction.customId,
            message: replyError?.message || String(replyError),
          });
        });
      }
    }
  },
};
