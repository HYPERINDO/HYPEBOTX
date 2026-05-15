const { PermissionFlagsBits, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-ticket-panel")
    .setDescription("Kirim panel ticket ke channel saat ini.")
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    if (!(interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || (await requireAdmin(interaction)))) {
      return;
    }

    await client.container.services.ticketService.sendTicketPanel(interaction.channel);
    await interaction.reply({ content: "Ticket panel berhasil dikirim.", flags: MessageFlags.Ephemeral });
  },
};
