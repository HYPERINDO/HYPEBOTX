const { PermissionFlagsBits, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-ticket-panel")
    .setDescription("Kirim panel ticket ke channel saat ini.")
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    if (!(interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || (await requireAdmin(interaction)))) {
      return;
    }

    // Defer reply to avoid "Unknown interaction" when the service is slow
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    await client.container.services.ticketService.sendTicketPanel(interaction.channel);

    // If we already deferred, edit the deferred reply; otherwise fallback to reply.
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Ticket panel berhasil dikirim." }).catch(() => null);
      } else {
        await safeReply(interaction, { content: "Ticket panel berhasil dikirim.", flags: MessageFlags.Ephemeral }).catch(() => null);
      }
    } catch (err) {
      // swallow to avoid logging noisy "Unknown interaction" errors here
    }
  },
};
