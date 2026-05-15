const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { getCalendarDateInTimeZone } = require("../../utils/time");

function normalize(text) {
    return String(text || "").trim();
}

function digitsOnly(text) {
    return String(text || "").replace(/\D+/g, "");
}

function parseOrderIdFromOrderLabel(orderLabel) {
    const raw = typeof orderLabel === "string" ? orderLabel : "";
    const m = raw.match(/ORDER ID:\s*([^\n\r]+)/i);
    return m?.[1]?.trim() || null;
}

function parseCustomerFromOrderLabel(orderLabel) {
    const raw = typeof orderLabel === "string" ? orderLabel : "";
    const parts = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // expected: [platform, customer, ORDER ID: ...]
    return parts[1] || null;
}

function clampNonNegInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x < 0) return 0;
    return Math.floor(x);
}

function getTodayISODate() {
    return getCalendarDateInTimeZone(new Date(), "Asia/Jakarta");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("set-order-heist")
        .setDescription("Set heist metadata untuk order aktif di antrian joki (agar joki progress bisa jalan).")
        .addStringOption((opt) =>
            opt
                .setName("order_id")
                .setDescription("Target order untuk dicocokkan (contoh: 0054). Cocokkan ke ORDER ID di orderLabel atau nama customer.")
                .setRequired(true),
        )
        .addIntegerOption((opt) =>
            opt
                .setName("total_heist")
                .setDescription("Total heist untuk order (contoh: 100).")
                .setRequired(true),
        )
        .addIntegerOption((opt) =>
            opt
                .setName("completed_heist")
                .setDescription("Heist yang sudah selesai (default 0).")
                .setRequired(false),
        )
        .addIntegerOption((opt) =>
            opt
                .setName("daily_limit_heist")
                .setDescription("Batas heist per hari (default env JOKI_DAILY_HEIST_LIMIT / 10).")
                .setRequired(false),
        ),
    async execute(interaction, client) {
        if (!isOwnerOrStaff(interaction.member)) {
            await interaction.reply({ content: "Hanya owner/staff yang bisa set order heist.", flags: MessageFlags.Ephemeral });
            return;
        }

        const orderId = normalize(sanitizeText(interaction.options.getString("order_id", true), 500));
        const totalHeist = clampNonNegInt(interaction.options.getInteger("total_heist", true));
        const completedHeist = clampNonNegInt(interaction.options.getInteger("completed_heist") ?? 0);

        const dailyLimitFallback = Number(process.env.JOKI_DAILY_HEIST_LIMIT ?? 10) || 10;
        const dailyLimitHeist = clampNonNegInt(interaction.options.getInteger("daily_limit_heist") ?? dailyLimitFallback) || dailyLimitFallback;

        if (!orderId) {
            await interaction.reply({ content: "order_id wajib diisi.", flags: MessageFlags.Ephemeral });
            return;
        }
        if (!Number.isFinite(totalHeist) || totalHeist <= 0) {
            await interaction.reply({ content: "total_heist harus > 0.", flags: MessageFlags.Ephemeral });
            return;
        }
        if (completedHeist > totalHeist) {
            await interaction.reply({ content: "completed_heist tidak boleh lebih besar dari total_heist.", flags: MessageFlags.Ephemeral });
            return;
        }

        const repositories = client.container?.repositories;
        const jokiRepository = repositories?.jokiRepository;
        if (!jokiRepository?.getQueue || !jokiRepository?.setOrderStatus) {
            await interaction.reply({ content: "jokiRepository belum tersedia.", flags: MessageFlags.Ephemeral });
            return;
        }

        const queue = await jokiRepository.getQueue(interaction.guild.id);
        if (!queue || !Array.isArray(queue.orders)) {
            await interaction.reply({ content: "Antrian joki tidak ditemukan untuk guild ini.", flags: MessageFlags.Ephemeral });
            return;
        }

        const orderIdNorm = digitsOnly(orderId);
        const match = queue.orders.find((order) => {
            if (!order?.orderLabel) return false;

            const labelOrderId = parseOrderIdFromOrderLabel(order.orderLabel);
            const labelOrderIdNorm = digitsOnly(labelOrderId);

            // match ORDER ID inside label
            if (labelOrderIdNorm && labelOrderIdNorm === orderIdNorm) return true;

            // match customer name (non-digit cases)
            const customer = parseCustomerFromOrderLabel(order.orderLabel);
            if (customer && String(customer).toLowerCase() === orderId.toLowerCase()) return true;

            // last resort: maybe order.id is used directly
            if (String(order.id || "").toLowerCase() === orderId.toLowerCase()) return true;

            // also allow digits-only match vs order.id
            if (digitsOnly(order.id) && digitsOnly(order.id) === orderIdNorm) return true;

            return false;
        });

        if (!match) {
            await interaction.reply({
                content: "Order tidak ditemukan di antrian aktif. Pastikan order_id cocok dengan ORDER ID di orderLabel.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const remainingHeist = Math.max(0, totalHeist - completedHeist);
        const progressDate = getTodayISODate();

        // Heist gating:
        // - remainingHeist === 0 => completed
        // - else if todayCompletedHeist >= dailyLimitHeist => hold
        // - else => processing
        const todayCompletedHeist = clampNonNegInt(match.progressDate === progressDate ? (match.todayCompletedHeist || 0) : 0);
        const todayCompletedNext = clampNonNegInt(todayCompletedHeist + completedHeist); // if this admin sets completedHeist from scratch, we align by setting progressDate today.
        const dailyLimit = dailyLimitHeist;
        const nextStatus = remainingHeist === 0 ? "completed" : todayCompletedNext >= dailyLimit ? "hold" : "processing";

        const updatedQueue = await jokiRepository.setOrderStatus(interaction.guild.id, match.id, {
            status: nextStatus,
            totalHeist,
            completedHeist,
            todayCompletedHeist: remainingHeist === 0 ? todayCompletedNext : clampNonNegInt(todayCompletedNext),
            remainingHeist,
            dailyLimitHeist: dailyLimit,
            progressDate,
        });

        const updatedOrder = updatedQueue?.orders?.find((o) => o.id === match.id) || match;

        await interaction.reply({
            content:
                `Heist set OK untuk ${orderId}.\n` +
                `totalHeist=${updatedOrder.totalHeist}\n` +
                `completedHeist=${updatedOrder.completedHeist}\n` +
                `remainingHeist=${updatedOrder.remainingHeist}\n` +
                `dailyLimitHeist=${updatedOrder.dailyLimitHeist}\n` +
                `status=${updatedOrder.status}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
