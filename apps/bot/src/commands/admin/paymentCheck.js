const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("paymentcheck")
    .setDescription("Cek dan update status payment.")
    .addStringOption((option) => option.setName("payment_id").setDescription("Payment ID").setRequired(true))
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Status payment")
        .setRequired(true)
        .addChoices(
          { name: "MENUNGGU CEK ADMIN", value: "submitted" },
          { name: "LUNAS", value: "paid" },
          { name: "REFUND", value: "refund" },
          { name: "DITOLAK", value: "cancelled" },
        ),
    )
    .addStringOption((option) => option.setName("note").setDescription("Catatan").setRequired(false)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await safeReply(interaction, { content: "Hanya staff yang bisa cek payment.", flags: MessageFlags.Ephemeral });
      return;
    }
    const payment = await client.container.services.storeOpsService.paymentCheck(
      interaction,
      sanitizeText(interaction.options.getString("payment_id", true), 500),
      sanitizeText(interaction.options.getString("status", true), 500),
      sanitizeText(interaction.options.getString("note"), 500) || "",
    );
    await safeReply(interaction, { content: payment ? `Payment \`${payment.id}\` diupdate ke \`${payment.status}\`.` : "Payment tidak ditemukan.", flags: MessageFlags.Ephemeral });
  },
};
