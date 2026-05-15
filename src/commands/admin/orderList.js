const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { clampContent } = require("../../utils/discordResponse");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("orderlist")
    .setDescription("Lihat daftar order terakhir.")
    .addIntegerOption((option) => option.setName("limit").setDescription("Jumlah order").setRequired(false).setMinValue(1).setMaxValue(20)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa lihat order list.", flags: MessageFlags.Ephemeral });
      return;
    }
    const rows = await client.container.services.storeOpsService.getOrderList(
      interaction.guild.id,
      interaction.options.getInteger("limit") || 10,
    );
    const content = rows.length
      ? rows.map((order) => client.container.services.storeOpsService.renderOrder(order)).join("\n\n")
      : "Belum ada order.";
    await interaction.reply({ content: clampContent(content), flags: MessageFlags.Ephemeral });
  },
};
