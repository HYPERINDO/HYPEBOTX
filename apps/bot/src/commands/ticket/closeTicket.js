const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { sanitizeText, validateInput } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("close-ticket")
    .setDescription("Tutup ticket saat ini.")
    .addStringOption((option) =>
      option.setName("reason").setDescription("Alasan penutupan").setRequired(false),
    )
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    const rawReason = sanitizeText(interaction.options.getString("reason"), 500) || "Closed by command";
    const validation = validateInput(rawReason, { maxLength: 240, required: true });
    if (!validation.valid) {
      const { safeReply } = require("../../utils/discordResponse");
      await safeReply(interaction, { content: `[ERROR] Alasan penutupan tidak valid: ${validation.errors.join(", ")}`, flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    const reason = sanitizeText(rawReason, 240);
    if (client.container.services.ticketService.requestCloseTicket) {
      await client.container.services.ticketService.requestCloseTicket(interaction, reason);
      return;
    }
    await client.container.services.ticketService.closeTicket(interaction, reason);
  },
};
