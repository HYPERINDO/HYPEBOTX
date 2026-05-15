const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { staffCommand } = require("../../config/permissions");
const { createEmbed } = require("../../utils/embed");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("delivery-status")
    .setDescription("Cek status delivery untuk order tertentu.")
    .setDefaultMemberPermissions(staffCommand)
    .addStringOption((option) =>
      option.setName("orderid").setDescription("Order ID (contoh: HYP-0001)").setRequired(true),
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const orderId = sanitizeText(interaction.options.getString("orderid", true), 500).trim();
    const deliveryService = client.container.services.deliveryService;

    if (!deliveryService) {
      return interaction.editReply({ content: "[ERROR] Delivery service belum aktif." });
    }

    const status = await deliveryService.getDeliveryStatus(interaction.guild.id, orderId);
    if (!status) {
      return interaction.editReply({ content: `[ERROR] Order \`${orderId}\` tidak ditemukan.` });
    }

    const embed = createEmbed({
      title: `Delivery Status — ${orderId}`,
      color: status.delivered ? 0x2ecc71 : status.reservedUnit ? 0xf39c12 : 0x95a5a6,
      fields: [
        { name: "Order ID", value: status.order.id, inline: true },
        { name: "Customer", value: `<@${status.order.userId}>`, inline: true },
        { name: "Product", value: status.order.product || "-", inline: true },
        { name: "SKU", value: status.order.sku || "-", inline: true },
        { name: "Payment", value: status.order.paymentStatus || "-", inline: true },
        { name: "Delivered", value: status.delivered ? "✅ Yes" : "❌ No", inline: true },
        { name: "Sold Unit", value: status.soldUnit?.id || "-", inline: true },
        { name: "Delivered At", value: status.soldUnit?.deliveredAt || "-", inline: true },
        { name: "Reserved Unit", value: status.reservedUnit?.id || "-", inline: true },
      ],
    });

    return interaction.editReply({ embeds: [embed] });
  },
};
