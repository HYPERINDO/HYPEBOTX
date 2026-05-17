const { Events, MessageFlags } = require("discord.js");
const { handleButton } = require("../../handlers/buttonHandler");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (!interaction.isButton()) {
      return;
    }

    const botConfig = require("../../config/bot");
    if (botConfig.allowedGuildIds.length > 0 && !botConfig.allowedGuildIds.includes(interaction.guild.id)) {
      client.container.logger.warn("Button interaction from unauthorized guild ignored", { guildId: interaction.guild.id });
      return;
    }

    try {
      // Maintenance check for customer-facing buttons (order, ticket, payment)
      const orderTicketButtons = ["ticketOrderButton", "orderFormButton", "topupFormButton", "paymentProofButton"];
      const { componentIds } = require("../../utils/constants");
      const isCustomerButton = orderTicketButtons.some((key) => interaction.customId === componentIds[key]);
      if (isCustomerButton) {
        const { checkMaintenanceForButton } = require("../../middlewares/maintenanceGuard");
        const ok = await checkMaintenanceForButton(interaction, client.container.repositories);
        if (!ok) return;
      }

      await handleButton(client, interaction);
    } catch (error) {
      const code = error?.code;
      const messageLower = String(error?.message || "").toLowerCase();
      const unknownInteraction = code === 10062 || messageLower.includes("unknown interaction");

      // Prevent error spam: if interaction already expired/unknown,
      // do not try followUp/reply again at event wrapper level.
      if (unknownInteraction) {
        client.container.logger?.warn?.("button interaction ignored: unknown interaction", {
          customId: interaction.customId,
          actorId: interaction?.user?.id,
          isReplied: Boolean(interaction?.replied),
          isDeferred: Boolean(interaction?.deferred),
          code,
          message: error?.message,
        });
        return;
      }

      client.container.logger.error("button interaction failed", {
        customId: interaction.customId,
        userId: interaction?.user?.id,
        guildId: interaction?.guild?.id || interaction?.guildId,
        isReplied: Boolean(interaction?.replied),
        isDeferred: Boolean(interaction?.deferred),
        message: error?.message,
        code: error?.code,
        path: error?.path,
        stack: error?.stack,
      });

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "Terjadi error saat memproses permintaan. Silakan coba lagi atau hubungi admin.",
          flags: MessageFlags.Ephemeral,
        }).catch((replyError) => {
          client.container.logger.warn("button error followUp failed", {
            customId: interaction.customId,
            message: replyError?.message || String(replyError),
          });
        });
      } else {
        await safeReply(interaction, {
          content: "Terjadi error saat memproses permintaan. Silakan coba lagi atau hubungi admin.",
          flags: MessageFlags.Ephemeral,
        }).catch((replyError) => {
          client.container.logger.warn("button error reply failed", {
            customId: interaction.customId,
            message: replyError?.message || String(replyError),
          });
        });
      }
    }
  },
};
