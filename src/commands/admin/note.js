const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Tambah catatan admin ke order.")
    .addStringOption((option) => option.setName("order_id").setDescription("Order ID").setRequired(true))
    .addStringOption((option) => option.setName("note").setDescription("Catatan").setRequired(true)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await safeReply(interaction, { content: "Hanya staff yang bisa tambah note.", flags: MessageFlags.Ephemeral });
      return;
    }
    const row = await client.container.services.storeOpsService.addNote(
      interaction,
      sanitizeText(interaction.options.getString("order_id", true), 500),
      sanitizeText(interaction.options.getString("note", true), 500),
    );
    await safeReply(interaction, { content: `Note tersimpan: \`${row.id}\`.`, flags: MessageFlags.Ephemeral });
  },
};
