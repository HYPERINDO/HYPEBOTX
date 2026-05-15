const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Buat atau sinkronkan role final server.")
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const summary = await client.container.services.roleService.ensureRoles(interaction.guild);
    await interaction.editReply(
      `Role selesai disinkronkan. Dibuat: ${summary.created.length}, diupdate: ${summary.updated.length}.`,
    );
  },
};
