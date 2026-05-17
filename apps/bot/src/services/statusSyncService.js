const { getCalendarDateInTimeZone } = require("../utils/time");

function createStatusSyncService({ logger, repositories }) {
  const QUEUE_STATUSES = new Set([
    "queued",
    "processing",
    "completed",
    "cancelled",
    "hold",
    "refund",
  ]);

  function normalizeStatus(status) {
    const raw = String(status || "").trim().toLowerCase();
    if (!raw) return "pending";

    const aliases = {
      process: "processing",
      proses: "processing",
      done: "completed",
      selesai: "completed",
      cancel: "cancelled",
      canceled: "cancelled",
      waiting_payment: "waiting",
      "waiting-payment": "waiting",
      waitingpayment: "waiting",
      hold: "hold",
      refund: "refunded",
      queued: "queued",
      queue: "queued",
      lunas: "paid",
    };

    return aliases[raw] || raw;
  }

  function toQueueStatus(normalizedStatus) {
    const map = {
      pending: "queued",
      queued: "queued",
      processing: "processing",
      waiting: "hold",
      paid: "queued",
      completed: "completed",
      cancelled: "cancelled",
      refunded: "refund",
      hold: "hold",
      refund: "refund",
    };
    return map[normalizedStatus] || null;
  }

  function toOrderStatus(normalizedStatus) {
    const map = {
      queued: "queued",
      hold: "hold",
      refund: "refunded",
    };
    return map[normalizedStatus] || normalizedStatus;
  }

  function toOrderPaymentStatus(normalizedStatus) {
    const map = {
      paid: "paid",
      cancelled: "cancelled",
      refunded: "refunded",
      refund: "refunded",
    };
    return map[normalizedStatus] || null;
  }

  function resolveFlowStatus(normalizedStatus, explicitFlowStatus = null) {
    const override = String(explicitFlowStatus || "").trim().toUpperCase();
    if (override) return override;

    const map = {
      pending: "MENUNGGU ADMIN",
      waiting: "MENUNGGU KONFIRMASI",
      queued: "DIPROSES",
      processing: "DIPROSES",
      hold: "DIPROSES",
      paid: "DIPROSES",
      completed: "SELESAI",
      cancelled: "DIBATALKAN",
      refunded: "DIBATALKAN",
      refund: "DIBATALKAN",
    };

    return map[normalizedStatus] || null;
  }

  async function findQueueOrderByTicketId(guildId, ticketId, repos) {
    if (!guildId || !ticketId || !repos.jokiRepository?.getQueue) {
      return null;
    }

    const queue = await repos.jokiRepository.getQueue(guildId);
    return queue?.orders?.find((order) => order.ticketId === ticketId) || null;
  }

  async function findQueueOrderById(guildId, queueId, repos) {
    if (!guildId || !queueId || !repos.jokiRepository?.getOrderById) {
      return null;
    }
    return repos.jokiRepository.getOrderById(guildId, queueId);
  }

  async function syncTicketOrderQueueStatus({
    guildId,
    ticketId,
    queueId,
    status,
    actorId,
    note = null,
    flowStatus = null,
    repositories: repoOverrides,
  }) {
    const repos = repoOverrides || repositories;
    const normalizedStatus = normalizeStatus(status);
    const orderStatus = toOrderStatus(normalizedStatus);
    const paymentStatus = toOrderPaymentStatus(normalizedStatus);
    const resolvedFlowStatus = resolveFlowStatus(normalizedStatus, flowStatus);
    const queueStatus = toQueueStatus(normalizedStatus);
    const errors = [];

    let queueOrder = null;
    if (queueId) {
      try {
        queueOrder = await findQueueOrderById(guildId, queueId, repos);
      } catch (error) {
        errors.push({ target: "queue_lookup", message: error.message });
        logger?.error?.("status sync queue lookup by id failed", {
          guildId,
          queueId,
          message: error.message,
        });
      }
    }

    if (!queueOrder && ticketId) {
      try {
        queueOrder = await findQueueOrderByTicketId(guildId, ticketId, repos);
      } catch (error) {
        errors.push({ target: "queue_lookup", message: error.message });
        logger?.error?.("status sync queue lookup by ticket failed", {
          guildId,
          ticketId,
          message: error.message,
        });
      }
    }

    const resolvedTicketId = ticketId || queueOrder?.ticketId || null;
    const resolvedQueueId = queueOrder?.id || queueId || null;

    // PATCH: if queue order doesn't exist but we are moving ticket into queue states,
    // create a joki queue entry (for joki/gta tickets) and connect ticketId -> queueId.
    if (
      !queueOrder &&
      resolvedTicketId &&
      queueStatus &&
      QUEUE_STATUSES.has(queueStatus) &&
      repos.jokiRepository?.addToQueue &&
      repos.jokiRepository?.ensureQueue &&
      // only for the "customer should now be in queue" states
      ["queued", "processing"].includes(queueStatus) &&
      repos.ticketRepository?.findById
    ) {
      try {
        const ticket = await repos.ticketRepository.findById(resolvedTicketId);
        const formType = String(ticket?.meta?.formType || "").toLowerCase();
        // treat both 'joki' and 'gta' as queue-able flows
        const isJoki = ["joki", "gta"].includes(formType);

        if (isJoki) {
          await repos.jokiRepository.ensureQueue(guildId);
          const openerId = ticket?.openerId || null;

          // Heuristic structured label for queue rendering.
          // Requirement: platform/paket/sisa/keterangan should come from joki detail string.
          const customerName = ticket?.meta?.customerName || "";
          const whatsapp = ticket?.meta?.whatsapp || "";
          const detailText = String(ticket?.meta?.detail || ticket?.meta?.gameInfo || ticket?.meta?.paymentNote || "");

          const platform = (() => {
            const raw = detailText.toLowerCase();
            if (raw.includes("enhanced")) return "ENHANCED";
            if (raw.includes("legacy")) return "LEGACY";
            // fallback: some forms put version in gameInfo/paymentNote
            const gi = String(ticket?.meta?.gameInfo || "").toLowerCase();
            if (gi.includes("enhanced")) return "ENHANCED";
            if (gi.includes("legacy")) return "LEGACY";
            return "ENHANCED";
          })();

          const dailyLimitHeist = (() => {
            const raw = process.env.JOKI_DAILY_HEIST_LIMIT;
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0) return 10;
            return n;
          })();

          function parseHeistCount(text) {
            const raw = String(text || "");
            // match: "50x HEIST" / "50 HEIST" / "50x"
            const m = raw.match(/(\d+)\s*(x)?\s*HEIST/i);
            if (m?.[1]) return Number(m[1]);
            const m2 = raw.match(/(\d+)\s*(x)?/i);
            if (m2?.[1] && raw.toUpperCase().includes("HEIST")) return Number(m2[1]);
            return null;
          }

          const paket = (() => {
            const raw = detailText;
            const m = raw.match(/PAKET[^:]*[:\s]*([^\n|]+)/i);
            if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
            // fallback: Money Heist 10x style / 36x HEIST / 30x HEIST
            const m2 = raw.match(/(?:SISA|Sisa)\s*[:\-]?\s*([0-9]+\s*x\s*HEIST|[0-9]+\s*HEIST|[0-9]+\s*x)/i);
            return m2 ? (m2[1].includes("HEIST") ? m2[1].toUpperCase() : `${m2[1].toUpperCase()} HEIST`) : "-";
          })();

          const sisa = (() => {
            const raw = detailText;
            const m = raw.match(/SISA[^:]*[:\s\-]*([^\n|]+)/i);
            if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
            const m2 = raw.match(/([0-9]+\s*x\s*HEIST|[0-9]+\s*HEIST)/i);
            return m2 ? m2[1].trim().toUpperCase() : "-";
          })();

          const totalHeistFromPaket = parseHeistCount(paket);

          // Mapping paket -> totalHeist (legacy/manual may not include explicit "<n>x HEIST")
          const totalHeistFromPackageName = (() => {
            const text = String(detailText || paket || "").toLowerCase();
            if (text.includes("sultan")) return 100;
            return null;
          })();

          const totalHeist = totalHeistFromPackageName ?? totalHeistFromPaket;
          const remainingHeistFromLabel = parseHeistCount(sisa);

          // If totalHeist is unknown, but we have remainingHeist text, assume totalHeist=remainingHeist for now.
          const resolvedTotalHeist = totalHeist ?? remainingHeistFromLabel;
          const remainingHeistInitial = resolvedTotalHeist ?? null;
          const dailyLimitHeistInitial = Number.isFinite(dailyLimitHeist) ? dailyLimitHeist : 10;

          const heistProgressInit = (() => {
            // For new orders: completedHeist=0, todayCompletedHeist=0
            // remainingHeist = totalHeist - completedHeist
            const total = resolvedTotalHeist ?? null;
            if (total === null) {
              return {
                totalHeist: null,
                completedHeist: 0,
                todayCompletedHeist: 0,
                remainingHeist: null,
                dailyLimitHeist: dailyLimitHeistInitial,
                progressDate: null,
              };
            }

            return {
              totalHeist: total,
              completedHeist: 0,
              todayCompletedHeist: 0,
              remainingHeist: total,
              dailyLimitHeist: dailyLimitHeistInitial,
              progressDate: getCalendarDateInTimeZone(new Date(), "Asia/Jakarta"), // YYYY-MM-DD
            };
          })();

          const keterangan = (() => {
            // Prefer targetDeadline / request-like text
            const t = ticket?.meta?.targetDeadline || ticket?.meta?.paymentNote || ticket?.meta?.paymentNote || "";
            if (t && String(t).trim() && t !== "-") return String(t).trim().replace(/\s+/g, " ");
            // fallback: anything after "NOTE:" in detail
            const m = detailText.match(/NOTE[^:]*:[\s]*([^\n]+)/i);
            return m?.[1] ? m[1].trim() : (ticket?.meta?.paymentNote || "-");
          })();

          const orderIdLabel = `ORDER ID: ${resolvedTicketId}`;
          const label = `🎮 ${platform}\n${customerName || (openerId ? `User:${openerId}` : "-")}\n${orderIdLabel}\nPAKET: ${paket}\nSISA: ${sisa}\nKETERANGAN: ${keterangan}`;

          const entry = await repos.jokiRepository.addToQueue(guildId, {
            userId: openerId,
            ticketId: resolvedTicketId,
            estimatedSeconds: 0,
            orderLabel: label,
            totalHeist: heistProgressInit.totalHeist,
            completedHeist: heistProgressInit.completedHeist,
            todayCompletedHeist: heistProgressInit.todayCompletedHeist,
            remainingHeist: heistProgressInit.remainingHeist,
            dailyLimitHeist: heistProgressInit.dailyLimitHeist,
            progressDate: heistProgressInit.progressDate,
          });

          queueOrder = entry;
        }
      } catch (error) {
        errors.push({ target: "queue_autocreate", message: error.message });
        logger?.error?.("status sync queue autocreate failed", {
          guildId,
          ticketId: resolvedTicketId,
          status: queueStatus,
          actorId,
          note,
          message: error.message,
        });
      }
    }

    const resolvedQueueIdAfterAuto = queueOrder?.id || queueId || null;

    let queueResult = null;
    if (
      resolvedQueueIdAfterAuto &&
      queueStatus &&
      QUEUE_STATUSES.has(queueStatus) &&
      repos.jokiRepository?.setOrderStatus
    ) {
      try {
        queueResult = await repos.jokiRepository.setOrderStatus(guildId, resolvedQueueIdAfterAuto, {
          status: queueStatus,
        });
      } catch (error) {
        errors.push({ target: "queue", message: error.message });
        logger?.error?.("status sync queue update failed", {
          guildId,
          queueId: resolvedQueueIdAfterAuto,
          status: queueStatus,
          actorId,
          note,
          message: error.message,
        });
      }
    }

    let orderResult = null;
    if (resolvedTicketId && repos.orderRepository?.updateByTicketId) {
      try {
        const orderChanges = {
          status: orderStatus,
        };
        if (paymentStatus) {
          orderChanges.paymentStatus = paymentStatus;
        }
        orderResult = await repos.orderRepository.updateByTicketId(resolvedTicketId, {
          ...orderChanges,
        });
      } catch (error) {
        errors.push({ target: "order", message: error.message });
        logger?.error?.("status sync order update failed", {
          guildId,
          ticketId: resolvedTicketId,
          status: orderStatus,
          actorId,
          note,
          message: error.message,
        });
      }
    }

    let ticketResult = null;
    if (resolvedTicketId && repos.ticketRepository?.update) {
      let existingTicket = null;
      if (repos.ticketRepository?.findById) {
        try {
          existingTicket = await repos.ticketRepository.findById(resolvedTicketId);
        } catch (error) {
          errors.push({ target: "ticket_lookup", message: error.message });
          logger?.error?.("status sync ticket lookup failed", {
            guildId,
            ticketId: resolvedTicketId,
            status: orderStatus,
            actorId,
            note,
            message: error.message,
          });
        }
      }

      const ticketChanges = {
        orderStatus,
      };

      if (orderStatus === "processing") {
        ticketChanges.claimedBy = actorId || null;
        ticketChanges.claimedAt = new Date().toISOString();
      }

      if (orderStatus === "completed") {
        ticketChanges.completedBy = actorId || null;
        ticketChanges.completedAt = new Date().toISOString();
      }

      if (resolvedFlowStatus) {
        ticketChanges.meta = {
          ...(existingTicket?.meta || {}),
          orderFlowStatus: resolvedFlowStatus,
        };
      }

      try {
        ticketResult = await repos.ticketRepository.update(resolvedTicketId, ticketChanges);
      } catch (error) {
        errors.push({ target: "ticket", message: error.message });
        logger?.error?.("status sync ticket update failed", {
          guildId,
          ticketId: resolvedTicketId,
          status: orderStatus,
          actorId,
          note,
          message: error.message,
        });
      }
    }

    return {
      ok: errors.length === 0,
      guildId,
      ticketId: resolvedTicketId,
      queueOrderId: resolvedQueueIdAfterAuto,
      status: orderStatus,
      flowStatus: resolvedFlowStatus,
      queueStatus,
      orderResult,
      ticketResult,
      queueResult,
      errors,
    };
  }

  return {
    syncTicketOrderQueueStatus,
  };
}

module.exports = {
  createStatusSyncService,
};
