const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { staffCommand } = require("../../config/permissions");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("refund")
        .setDescription("Ajukan refund untuk Order ID (invoice number = order.id).")
        .setDefaultMemberPermissions(staffCommand)
        .addStringOption((option) =>
            option.setName("orderid").setDescription("Order ID (contoh: HYP-0001)").setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Alasan refund (wajib).").setRequired(true),
        ),
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!isOwnerOrStaff(interaction.member)) {
            return interaction.editReply({ content: "Hanya staff/admin yang bisa mengajukan refund." });
        }

        const orderId = sanitizeText(interaction.options.getString("orderid", true), 500).trim();
        const reason = sanitizeText(interaction.options.getString("reason", true), 500).trim();

        const result = await client.container.services.refundDisputeService.requestRefundOrDispute(interaction, {
            type: "refund",
            orderId,
            reason,
            ticketId: null,
        });

        if (!result?.ok) {
            return interaction.editReply({ content: result?.message || "Gagal mengajukan refund." });
        }

        return interaction.editReply({
            content: `✅ Refund requested.\nDispute/Refund ID: \`${result.dispute.id}\`\nOrder ID: \`${result.order.id}\``,
        });
    },
};
