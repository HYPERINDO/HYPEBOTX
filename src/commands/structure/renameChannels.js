const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rename-channels")
    .setDescription("Rapihkan nama channel agar konsisten.")
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const changed = await client.container.services.structureService.renameChannels(interaction.guild);
    await interaction.editReply(
      changed.length ? `Nama channel diubah:\n- ${changed.join("\n- ")}` : "Tidak ada nama channel yang perlu diubah.",
    );
  },
};
