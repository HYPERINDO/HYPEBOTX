const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("salesreport")
    .setDescription("Lihat ringkasan penjualan/order."),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await safeReply(interaction, { content: "Hanya staff yang bisa lihat sales report.", flags: MessageFlags.Ephemeral });
      return;
    }
    const report = await client.container.services.storeOpsService.getSalesReport(interaction.guild.id);
    await safeReply(interaction, {
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
