const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sort-channels")
    .setDescription("Urutkan channel sesuai template GameStore.")
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    await client.container.services.structureService.sortChannels(interaction.guild, "gamestore");
    await interaction.reply({ content: "Urutan channel sudah disinkronkan.", flags: MessageFlags.Ephemeral });
  },
};
