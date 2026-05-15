const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("salesreport")
    .setDescription("Lihat ringkasan penjualan/order."),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa lihat sales report.", flags: MessageFlags.Ephemeral });
      return;
    }
    const report = await client.container.services.storeOpsService.getSalesReport(interaction.guild.id);
    await interaction.reply({
      content: [
        "**Sales Report**",
        `Total order: ${report.total}`,
        `Paid/Lunas: ${report.paid}`,
        `Completed: ${report.completed}`,
        `Pending/aktif: ${report.pending}`,
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  },
};
