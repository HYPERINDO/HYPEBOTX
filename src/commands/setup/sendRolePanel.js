const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-role-panel")
    .setDescription("Kirim self role panel ke channel saat ini.")
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    await client.container.services.verifyService.sendRolePanel(interaction.channel);
    await interaction.reply({ content: "Self role panel berhasil dikirim.", flags: MessageFlags.Ephemeral });
  },
};
