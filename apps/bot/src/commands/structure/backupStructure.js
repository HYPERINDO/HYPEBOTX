const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("backup-structure")
    .setDescription("Buat backup struktur server.")
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const fileName = await client.container.services.backupService.backupStructure(interaction.guild);
    await interaction.editReply(`Backup berhasil dibuat: \`${fileName}\`.`);
  },
};
