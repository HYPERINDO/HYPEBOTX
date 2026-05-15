const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { sanitizeText, validateInput } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reopen-ticket")
    .setDescription("Buka ulang ticket yang pernah ditutup.")
    .addStringOption((option) =>
      option.setName("ticket_id").setDescription("Nomor ticket, misalnya 0001").setRequired(true),
    )
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    const rawTicketId = sanitizeText(interaction.options.getString("ticket_id", true), 500);
    const ticketValidation = validateInput(rawTicketId, {
      maxLength: 20,
      required: true,
      pattern: /^[a-zA-Z0-9-]+$/,
    });

    if (!ticketValidation.valid) {
      const { safeReply } = require("../../utils/discordResponse");
      await safeReply(interaction, { content: `[ERROR] Ticket ID tidak valid: ${ticketValidation.errors.join(", ")}`, flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    const ticketId = sanitizeText(rawTicketId, 20);
    const result = await client.container.services.ticketService.reopenTicket(
      interaction.guild,
      ticketId,
      interaction.user.id,
    );

    if (!result) {
      const { safeReply } = require("../../utils/discordResponse");
      await safeReply(interaction, { content: "Ticket tidak ditemukan.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    const { safeReply } = require("../../utils/discordResponse");
    await safeReply(interaction, { content: `Ticket #${ticketId} dibuka ulang di ${result.channel}.`, flags: MessageFlags.Ephemeral }).catch(() => null);
  },
};
