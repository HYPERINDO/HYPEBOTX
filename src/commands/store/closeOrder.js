const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { staffCommand } = require("../../config/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("close-order")
    .setDescription("Tutup order pada ticket aktif.")
    .addStringOption((option) =>
      option
        .setName("final_status")
        .setDescription("Status akhir order")
        .setRequired(false)
        .addChoices(
          { name: "completed", value: "completed" },
          { name: "cancelled", value: "cancelled" },
        ),
    )
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    const finalStatus = sanitizeText(interaction.options.getString("final_status"), 500) || "completed";
    const result = await client.container.services.orderService.closeOrder(interaction, finalStatus);
    if (!result.ok && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: result.message || "Gagal menutup order.", flags: MessageFlags.Ephemeral });
    }
  },
};
