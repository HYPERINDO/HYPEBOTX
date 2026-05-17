const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dispute")
        .setDescription("Update status dispute/refund. Dispute/Refund decision requires reason.")
        .setDefaultMemberPermissions(staffCommand)
        .addStringOption((option) =>
            option.setName("disputeid").setDescription("Dispute/Refund ID (mis. DIS-123456789)").setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("status")
                .setDescription("Next status")
                .setRequired(true)
                .addChoices(
                    { name: "REVIEWING", value: "reviewing" },
                    { name: "APPROVED", value: "approved" },
                    { name: "REJECTED", value: "rejected" },
                ),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Reason wajib (untuk decision)").setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("adminnote").setDescription("Catatan admin (opsional)").setRequired(false),
        ),
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!isOwnerOrStaff(interaction.member)) {
            return interaction.editReply({ content: "Hanya staff/admin yang bisa mengubah status dispute/refund." });
        }

        const disputeId = sanitizeText(interaction.options.getString("disputeid", true), 500).trim();
        const status = sanitizeText(interaction.options.getString("status", true), 500).trim();
        const reason = sanitizeText(interaction.options.getString("reason", true), 500).trim();
        const adminNote = sanitizeText(interaction.options.getString("adminnote", false), 500) || "";

        const result = await client.container.services.refundDisputeService.updateDisputeStatus(interaction, {
            disputeId,
            nextStatus: status,
            reason,
            adminNote,
        });

        if (!result?.ok) {
            return interaction.editReply({ content: result?.message || "Gagal update status." });
        }

        return interaction.editReply({
            content: `✅ Status diperbarui.\nDispute/Refund ID: \`${disputeId}\`\nNext status: \`${status}\``,
        });
    },
};
