const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { staffCommand } = require("../../config/permissions");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

function parseOrderIdFromOrderLabel(orderLabel) {
    const raw = typeof orderLabel === "string" ? orderLabel : "";
    const m = raw.match(/ORDER ID:\s*([^\n\r]+)/i);
    return m?.[1]?.trim() || null;
}

function parseCustomerFromOrderLabel(orderLabel) {
    // orderLabel format (from statusSync): first line platform, second line customer name
    const raw = typeof orderLabel === "string" ? orderLabel : "";
    const parts = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return parts[1] || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("joki-history")
        .setDescription("Audit riwayat joki (DONE tetap masuk history, tidak tampil di active queue).")
        .setDefaultMemberPermissions(staffCommand)
        .addStringOption((option) =>
            option
                .setName("orderid")
                .setDescription("Cari berdasarkan Order ID (contoh: HYP-0001)")
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("customer")
                .setDescription("Cari berdasarkan customer (nama di order label)")
                .setRequired(false),
        ),
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!isOwnerOrStaff(interaction.member)) {
            return interaction.editReply({ content: "Hanya staff/admin yang bisa akses joki history." });
        }

        const orderId = sanitizeText(interaction.options.getString("orderid", false)?.trim() || "", 50);
        const customer = sanitizeText(interaction.options.getString("customer", false)?.trim() || "", 100);

        const { jokiRepository } = client.container.repositories;
        let matched = [];
        if (jokiRepository?.listHistory) {
            matched = await jokiRepository.listHistory(interaction.guild.id, {
                orderId,
                customer,
            }).catch(() => []);
        } else {
            const queue = await jokiRepository.getQueue(interaction.guild.id).catch(() => null);
            const orders = queue?.orders || [];
            const history = orders.filter((o) => ["completed", "refund", "cancelled"].includes(o.status));
            matched = history.filter((o) => {
                if (!orderId && !customer) return true;
                const label = o.orderLabel || "";
                const labelOrderId = parseOrderIdFromOrderLabel(label);
                const labelCustomer = parseCustomerFromOrderLabel(label);

                if (orderId && labelOrderId && String(labelOrderId).toLowerCase() === String(orderId).toLowerCase()) {
                    return true;
                }
                if (customer && labelCustomer && String(labelCustomer).toLowerCase().includes(String(customer).toLowerCase())) {
                    return true;
                }
                return false;
            });
        }

        const total = matched.length;
        const lines = matched
            .slice(0, 20)
            .map((o, idx) => {
                const labelOrderId = parseOrderIdFromOrderLabel(o.orderLabel || "");
                const labelCustomer = parseCustomerFromOrderLabel(o.orderLabel || "");
                const finishedAt = o.completedAt || o.createdAt || "-";
                return `#${idx + 1} | QUEUE: ${o.id || "-"} | ORDER: ${labelOrderId || o.ticketId || "-"} | CUSTOMER: ${labelCustomer || "-"} | STATUS: ${o.status} | AT: ${finishedAt}`;
            });

        return interaction.editReply({
            content:
                total === 0
                    ? "Tidak ada data history joki yang cocok."
                    : `Ditemukan: ${total} entry.\n\n${lines.join("\n")}`.slice(0, 1900),
        });
    },
};
