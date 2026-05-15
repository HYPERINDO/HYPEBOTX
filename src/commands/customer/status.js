const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireVerifiedMember } = require("../../middlewares/permissionGuard");
const { clampContent } = require("../../utils/discordResponse");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Cek status order kamu."),
  async execute(interaction, client) {
    if (!(await requireVerifiedMember(interaction))) return;
    const content = await client.container.services.storeOpsService.getMyStatus(interaction);
    await interaction.reply({
      content: clampContent(content),
      flags: MessageFlags.Ephemeral,
    });
  },
};
