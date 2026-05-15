const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-basic")
    .setDescription("Setup template basic atau community ringan.")
    .addStringOption((option) =>
      option
        .setName("template")
        .setDescription("Template yang ingin dipakai")
        .setRequired(false)
        .addChoices(
          { name: "basic", value: "basic" },
          { name: "community", value: "community" },
        ),
    )
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    const template = sanitizeText(interaction.options.getString("template"), 500) || "basic";
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const summary = await client.container.services.structureService.ensureTemplate(interaction.guild, template);
    await interaction.editReply(`Setup template \`${template}\` selesai. Kategori: ${summary.categories}, channel: ${summary.channels}.`);
  },
};
