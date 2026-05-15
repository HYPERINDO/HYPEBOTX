const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { clampContent } = require("../../utils/discordResponse");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("updateorder")
    .setDescription("Update status order.")
    .addStringOption((option) => option.setName("order_id").setDescription("Contoh ORD-0001").setRequired(true))
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Status baru")
        .setRequired(true)
        .addChoices(
          { name: "PENDING", value: "pending" },
          { name: "QUEUED", value: "queued" },
          { name: "WAITING", value: "waiting" },
          { name: "PROCESS", value: "processing" },
          { name: "DONE", value: "completed" },
          { name: "CANCEL", value: "cancelled" },
          { name: "REFUNDED", value: "refunded" },
          { name: "REFUND (LEGACY)", value: "refund" },
          { name: "HOLD", value: "hold" },
          { name: "PAID", value: "paid" },
        ),
    )
    .addStringOption((option) => option.setName("note").setDescription("Catatan admin").setRequired(false)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa update order.", flags: MessageFlags.Ephemeral });
      return;
    }
    const order = await client.container.services.storeOpsService.updateOrder(
      interaction,
      sanitizeText(interaction.options.getString("order_id", true), 500),
      sanitizeText(interaction.options.getString("status", true), 500),
      sanitizeText(interaction.options.getString("note"), 500) || "",
    );
    await interaction.reply({
      content: clampContent(order ? `Order diupdate:\n${client.container.services.storeOpsService.renderOrder(order)}` : "Order tidak ditemukan."),
      flags: MessageFlags.Ephemeral,
    });
  },
};
