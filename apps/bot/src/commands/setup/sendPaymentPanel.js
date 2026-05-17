const { PermissionFlagsBits, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-payment-panel")
    .setDescription("Kirim panel payment ke channel saat ini.")
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    if (!(interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || (await requireAdmin(interaction)))) {
      return;
    }

    await client.container.services.paymentService.sendPaymentPanel(interaction.channel);
    const { safeReply } = require("../../utils/discordResponse");
    await safeReply(interaction, { content: "Payment panel berhasil dikirim.", flags: MessageFlags.Ephemeral }).catch(() => null);
  },
};
