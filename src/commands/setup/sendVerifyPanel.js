const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-verify-panel")
    .setDescription("Kirim verify panel ke channel saat ini.")
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    await client.container.services.verifyService.sendVerifyPanel(interaction.channel);
    await interaction.reply({ content: "Verify panel berhasil dikirim.", flags: MessageFlags.Ephemeral });
  },
};
