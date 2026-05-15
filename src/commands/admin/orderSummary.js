const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { staffCommand } = require("../../config/permissions");
const { createEmbed } = require("../../utils/embed");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

function formatMaybe(value) {
    return value === undefined || value === null || value === "" ? "-" : String(value);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("order-summary")
        .setDescription("Tampilkan ringkasan order lengkap dari Order ID.")
        .setDefaultMemberPermissions(staffCommand)
        .addStringOption((option) =>
            option.setName("orderid").setDescription("Order ID (contoh: HYP-0001)").setRequired(true),
        ),
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!isOwnerOrStaff(interaction.member)) {
            return interaction.editReply({ content: "Hanya staff/admin yang bisa mengakses ini." });
        }

        const orderId = sanitizeText(interaction.options.getString("orderid", true), 500).trim();
        const { orderRepository } = client.container.repositories;
        const order = await orderRepository.findById(orderId);

        if (!order) {
            return interaction.editReply({ content: `Order \`${orderId}\` tidak ditemukan.` });
        }

        const embed = createEmbed({
            title: `Order Summary — ${order.id}`,
            color: 0x57f287,
            fields: [
                { name: "Order ID", value: order.id, inline: true },
                { name: "Customer", value: `<@${order.userId}>`, inline: true },
                { name: "Customer Name", value: formatMaybe(order.customerName), inline: true },
                { name: "Layanan/Kategori", value: formatMaybe(order.category), inline: true },
                { name: "Produk", value: formatMaybe(order.product), inline: true },
                { name: "SKU", value: formatMaybe(order.sku), inline: true },
                { name: "Price/Total", value: formatMaybe(order.price), inline: true },
                { name: "Payment Status", value: formatMaybe(order.paymentStatus), inline: true },
                { name: "Order Status", value: formatMaybe(order.status), inline: true },
                { name: "Staff Handle", value: order.staffHandle ? `<@${order.staffHandle}>` : "-", inline: true },
                { name: "Admin Note", value: formatMaybe(order.adminNote), inline: false },
            ],
            footer: interaction.guild.name,
        });

        return interaction.editReply({ embeds: [embed] });
    },
};
