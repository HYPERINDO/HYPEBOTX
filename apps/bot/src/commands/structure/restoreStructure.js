const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("restore-structure")
    .setDescription("Restore struktur server dari backup terakhir atau nama file tertentu.")
    .addStringOption((option) =>
      option.setName("backup").setDescription("Nama file backup").setRequired(false),
    )
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const backup = sanitizeText(interaction.options.getString("backup"), 500);
    const restored = await client.container.services.backupService.restoreStructure(interaction.guild, backup);
    await interaction.editReply(`Restore selesai dari backup \`${restored}\`.`);
  },
};
