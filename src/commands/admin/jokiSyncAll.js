const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { hasJokiCrewAccess } = require("../../utils/permissionCheck");

function normalizeString(value) {
    return String(value || "").trim();
}

function parseBool(value) {
    const raw = String(value ?? "").toLowerCase().trim();
    if (raw === "true" || raw === "1" || raw === "yes" || raw === "y") return true;
    return raw === "false" || raw === "0" || raw === "no" || raw === "n" ? false : false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("joki-sync-all")
        .setDescription("Repair/sync ulang data joki/order/ticket (tanpa reset).")
        .addBooleanOption((opt) =>
            opt
                .setName("dry_run")
                .setDescription("Jika true: hanya scan & report (tidak menulis perubahan).")
                .setRequired(false),
        ),
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!hasJokiCrewAccess(interaction.member)) {
            return interaction.editReply?.({ content: "❌ [ERROR] Tidak punya izin." }).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }

        const { services, repositories } = client.container;

        const statusSyncService = services?.statusSyncService;
        const ticketRepository = repositories?.ticketRepository;
        const orderRepository = repositories?.orderRepository;
        const jokiRepository = repositories?.jokiRepository;

        if (!statusSyncService?.syncTicketOrderQueueStatus) {
            return interaction.editReply?.({ content: "❌ [ERROR] statusSyncService tidak tersedia." }).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }
        if (!ticketRepository || !orderRepository || !jokiRepository) {
            return interaction.editReply?.({ content: "❌ [ERROR] repositories tidak lengkap." }).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }

        const dryRun = interaction.options.getBoolean("dry_run") ?? false;

        const guildId = interaction.guild.id;
        const actorId = interaction.user.id;

        const errors = [];
        const results = {
            ticketsChecked: 0,
            ordersChecked: 0,
            queueChecked: 0,
            syncOk: 0,
            syncSkipped: 0,
            syncFail: 0,
            dryRun: dryRun,
        };

        const pushError = (target, message, extra = {}) => {
            errors.push({ target, message, ...extra });
        };

        // 1) Scan semua ticket
        const allTickets = await ticketRepository.getAll().catch((e) => {
            pushError("ticket_scan", e?.message || String(e));
            return [];
        });

        const activeTickets = (allTickets || []).filter((t) => {
            // Guard: jangan sync closed
            const status = normalizeString(t?.status || "");
            if (!status) return true; // legacy
            return status.toLowerCase() !== "closed";
        });

        // Heuristic: sync hanya ticket yang punya order-like meta.
        // statusSyncService bisa meng-handle non-order, tapi untuk efisiensi kita batasi.
        const candidateTickets = activeTickets.filter((t) => {
            const type = normalizeString(t?.type || "");
            if (type.toLowerCase() !== "order") return false;
            return Boolean(t?.meta?.formType || t?.meta?.detail || t?.meta?.paymentNote || true);
        });

        results.ticketsChecked = candidateTickets.length;

        // 2) Scan semua order
        const allOrders = await orderRepository.getAll().catch((e) => {
            pushError("order_scan", e?.message || String(e));
            return [];
        });

        const activeOrders = (allOrders || []).filter((o) => {
            const status = normalizeString(o?.status || "");
            if (!status) return true;
            const s = status.toLowerCase();
            return !["completed", "done", "closed"].includes(s);
        });

        results.ordersChecked = activeOrders.length;

        // 3) Scan joki queue aktif (per guild) + entries
        const queue = await jokiRepository.getQueue(guildId).catch(() => null);
        const queueOrders = queue?.orders || [];
        results.queueChecked = queueOrders.length;

        if (dryRun) {
            // Dry-run: hanya report. Tidak menulis perubahan.
            return interaction
                .editReply?.({
                    content:
                        `✅ DRY RUN /joki-sync-all selesai\n` +
                        `Ticket dicek: ${results.ticketsChecked}\n` +
                        `Order dicek: ${results.ordersChecked}\n` +
                        `Queue dicek: ${results.queueChecked}\n\n` +
                        `Berhasil sync: 0\n` +
                        `Dilewati: 0\n` +
                        `Gagal: 0\n` +
                        (errors.length ? `\nCatatan error scan: ${errors.length}` : ""),
                })
                .catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }

        // LIVE: panggil sync per ticket yang punya ticketId
        for (const ticket of candidateTickets) {
            const ticketId = ticket?.id;
            if (!ticketId) continue;

            try {
                const sync = await statusSyncService.syncTicketOrderQueueStatus({
                    guildId,
                    ticketId,
                    actorId,
                    note: "Manual sync all by admin",
                });

                if (sync?.ok) results.syncOk += 1;
                else {
                    results.syncSkipped += 1; // partial
                    if (Array.isArray(sync?.errors) && sync.errors.length) {
                        for (const err of sync.errors) {
                            pushError("ticket_sync", err?.message || "sync error", { ticketId, target: err?.target });
                        }
                    }
                }
            } catch (e) {
                results.syncFail += 1;
                pushError("ticket_sync", e?.message || String(e), { ticketId });
            }
        }

        // LIVE: panggil sync per queueId (kalau ada)
        // statusSyncService update by queueId but for each queue order we need queueId and relies on setOrderStatus for that queue entry.
        for (const qOrder of queueOrders) {
            const queueId = qOrder?.id;
            const ticketId = qOrder?.ticketId;
            if (!queueId && !ticketId) continue;

            try {
                const sync = await statusSyncService.syncTicketOrderQueueStatus({
                    guildId,
                    queueId,
                    ticketId: ticketId || null,
                    actorId,
                    note: "Manual sync all by admin (queue fallback)",
                });

                if (sync?.ok) results.syncOk += 1;
                else {
                    results.syncSkipped += 1;
                    if (Array.isArray(sync?.errors) && sync.errors.length) {
                        for (const err of sync.errors) {
                            pushError("queue_sync", err?.message || "sync error", { queueId, ticketId, target: err?.target });
                        }
                    }
                }
            } catch (e) {
                results.syncFail += 1;
                pushError("queue_sync", e?.message || String(e), { queueId, ticketId });
            }
        }

        // Summarize
        const topErrors = errors.slice(0, 5).map((e) => `- ${e.target}: ${e.message}`).join("\n");

        const content =
            `✅ Sync All selesai\n\n` +
            `Ticket dicek: ${results.ticketsChecked}\n` +
            `Order dicek: ${results.ordersChecked}\n` +
            `Queue dicek: ${results.queueChecked}\n\n` +
            `Berhasil sync: ${results.syncOk}\n` +
            `Dilewati: ${results.syncSkipped}\n` +
            `Gagal: ${results.syncFail}\n` +
            (errors.length
                ? `\nCatatan (contoh ${Math.min(5, errors.length)}):\n${topErrors}\n${errors.length > 5 ? `... (+${errors.length - 5} error)` : ""}`
                : "");

        return interaction.editReply?.({ content }).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
    },
};
