const { isOwnerOrStaff } = require("../utils/permissionCheck");

function createRefundDisputeService({
    botConfig,
    logger,
    repositories,
    orderService,
    loggingService,
}) {
    function logBestEffort(action, context, error) {
        logger?.warn?.(`${action} failed`, {
            ...(context || {}),
            message: error?.message || String(error),
        });
    }

    function normalizeReason(reason) {
        const safe = String(reason || "").trim();
        if (!safe) return "-";
        return safe.slice(0, 2000);
    }

    function requireNonEmptyReason(reason, fallbackMessage = "Reason wajib diisi.") {
        const safe = String(reason || "").trim();
        if (!safe) {
            return { ok: false, message: fallbackMessage };
        }
        return { ok: true, reason: safe };
    }

    function getNextStatus(currentStatus, nextStatus) {
        const allowed = new Set([
            "requested",
            "reviewing",
            "approved",
            "rejected",
        ]);

        const next = String(nextStatus || "").toLowerCase();
        if (!allowed.has(next)) return { ok: false, message: "Status dispute/refund tidak valid." };

        // Minimal sanity: requested -> reviewing -> approved/rejected
        const cur = String(currentStatus || "").toLowerCase();
        const transition = `${cur}=>${next}`;

        const transitionsAllowed = new Set([
            "requested=>reviewing",
            "reviewing=>approved",
            "reviewing=>rejected",
            // allow direct approve/reject for ops convenience
            "requested=>approved",
            "requested=>rejected",
        ]);

        if (!transitionsAllowed.has(transition)) {
            return { ok: false, message: `Transition tidak diizinkan: ${transition}` };
        }

        return { ok: true, status: next };
    }

    function buildRefundDisputeEmbed({ dispute, order, interaction }) {
        const title =
            dispute.type === "refund"
                ? `REFUND — ${dispute.id}`
                : `DISPUTE — ${dispute.id}`;

        return loggingService?.createEmbed?.({
            title,
            color: 0xe67e22,
            fields: [
                { name: "Dispute/Refund ID", value: dispute.id, inline: true },
                { name: "Order ID (HYP-XXXX)", value: order?.id || dispute.orderId || "-", inline: true },
                { name: "Customer", value: `<@${dispute.customerUserId}>`, inline: true },
                { name: "Type", value: dispute.type || "-", inline: true },
                { name: "Status", value: dispute.status || "-", inline: true },
                { name: "Reason", value: dispute.reason || "-", inline: false },
                { name: "Reviewer Note", value: dispute.reviewerNote || "-", inline: false },
                { name: "Admin Decision At", value: dispute.adminDecisionAt || "-", inline: true },
                { name: "Admin Handle", value: dispute.adminHandle ? `<@${dispute.adminHandle}>` : "-", inline: true },
            ],
            footer: interaction?.guild?.name || "-",
        }) || null;
    }

    async function requestRefundOrDispute(interaction, {
        type,
        orderId,
        reason,
        ticketId = null,
    }) {
        const resolvedReason = requireNonEmptyReason(reason);
        if (!resolvedReason.ok) {
            return { ok: false, message: resolvedReason.message };
        }

        const order = await repositories.orderRepository?.findById?.(orderId).catch(() => null);
        if (!order) {
            return { ok: false, message: `Order \`${orderId}\` tidak ditemukan.` };
        }

        const disputes = await repositories.refundDisputeRepository?.findByOrderId?.(orderId);
        const latest = Array.isArray(disputes) && disputes.length ? disputes[disputes.length - 1] : null;
        if (latest && ["requested", "reviewing"].includes(latest.status)) {
            return { ok: false, message: `Ada klaim aktif (${latest.status}). Mohon tunggu proses.` };
        }

        const id = `${type.toUpperCase().slice(0, 3)}-${Date.now()}`;
        const row = await repositories.refundDisputeRepository.create({
            id,
            guildId: interaction.guild.id,
            orderId: order.id,
            ticketId,
            customerUserId: order.userId,
            customerName: order.customerName || "",
            type,
            status: "requested",
            reason: normalizeReason(resolvedReason.reason),
            adminHandle: null,
            staffHandle: interaction.user?.id || null,
            reviewerNote: "",
            adminDecisionAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // Logging
        await loggingService?.logRefundOrDispute?.(
            interaction.guild,
            "Refund/Dispute Requested",
            `${type} diminta untuk Order \`${order.id}\`.`,
            [
                { name: "Dispute ID", value: row.id, inline: true },
                { name: "Order ID", value: row.orderId, inline: true },
                { name: "Customer", value: interaction.user.tag, inline: true },
            ],
            row,
        ).catch(() => null);

        return { ok: true, dispute: row, order };
    }

    async function updateDisputeStatus(interaction, {
        disputeId,
        nextStatus,
        reason,
        adminNote = "",
    }) {
        if (!repositories.refundDisputeRepository?.findById || !repositories.refundDisputeRepository?.updateById) {
            return { ok: false, message: "Service dispute/refund belum siap." };
        }

        const dispute = await repositories.refundDisputeRepository.findById(disputeId).catch(() => null);
        if (!dispute) {
            return { ok: false, message: `Dispute/Refund \`${disputeId}\` tidak ditemukan.` };
        }

        // Only staff/admin
        if (!isOwnerOrStaff(interaction.member)) {
            return { ok: false, message: "Hanya staff/admin yang bisa mengubah status." };
        }

        // Reason wajib tercatat untuk decision (approved/rejected) dan untuk reviewing
        const safeReasonCheck = requireNonEmptyReason(reason || dispute.reason || "-", "Reason wajib diisi untuk keputusan.");
        if (!safeReasonCheck.ok) {
            return { ok: false, message: safeReasonCheck.message };
        }

        const next = getNextStatus(dispute.status, nextStatus);
        if (!next.ok) return next;

        const updated = await repositories.refundDisputeRepository.updateById(dispute.id, {
            status: next.status,
            adminHandle: interaction.user.id,
            reviewerNote: String(adminNote || "").trim().slice(0, 2000),
            reason: normalizeReason(safeReasonCheck.reason),
            adminDecisionAt: next.status === "approved" || next.status === "rejected" ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
        });

        const order = await repositories.orderRepository.findById(dispute.orderId).catch(() => null);

        await loggingService?.logRefundOrDispute?.(
            interaction.guild,
            "Refund/Dispute Status Updated",
            `Status ${dispute.type} (${dispute.id}) menjadi ${next.status}.`,
            [
                { name: "Dispute ID", value: updated?.id || dispute.id, inline: true },
                { name: "Order ID", value: order?.id || dispute.orderId, inline: true },
                { name: "Staff", value: interaction.user.tag, inline: true },
            ],
            updated,
        ).catch(() => null);

        // Priority 1 spec: invoice update on refund/dispute status changes
        // We update invoice embed (edited) via orderService if possible.
        if (orderService?.sendOrEditInvoice && order) {
            try {
                // paymentService will have created invoice; if not, it will create it now.
                await orderService.sendOrEditInvoice({
                    channel: interaction.channel,
                    interaction,
                    order,
                    orderId: order.id,
                    repositories,
                });
            } catch (error) {
                logBestEffort("invoice edit after refund/dispute", { disputeId }, error);
            }
        }

        return { ok: true, dispute: updated, order };
    }

    return {
        requestRefundOrDispute,
        updateDisputeStatus,
        getLatestByOrderId: async (orderId) =>
            repositories.refundDisputeRepository?.findLatestByOrderId?.(orderId),
        getByOrderId: async (orderId) =>
            repositories.refundDisputeRepository?.findByOrderId?.(orderId),
    };
}

module.exports = {
    createRefundDisputeService,
};
