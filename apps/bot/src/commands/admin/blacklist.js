const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Blacklist customer.")
    .addUserOption((option) => option.setName("user").setDescription("User").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Alasan").setRequired(true)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      const { safeReply } = require("../../utils/discordResponse");
      await safeReply(interaction, { content: "Hanya staff yang bisa blacklist.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }
    const row = await client.container.services.storeOpsService.setBlacklist(
      interaction,
      interaction.options.getUser("user", true),
      sanitizeText(interaction.options.getString("reason", true), 500),
    );
    const { safeReply } = require("../../utils/discordResponse");
    await safeReply(interaction, { content: `User masuk blacklist: \`${row.userId}\`.`, flags: MessageFlags.Ephemeral }).catch(() => null);
  },
};
