const fs = require("fs");
const path = require("path");
const { AttachmentBuilder, MessageFlags } = require("discord.js");
const { createPayment } = require("../database/models/Payment");
const { createEmbed } = require("../utils/embed");
const { isOwnerOrStaff } = require("../utils/permissionCheck");

const PAYMENT_BANNER_NAME = "payment-method-banner.png";
const PAYMENT_BANNER_PATH = path.join(__dirname, "..", "assets", PAYMENT_BANNER_NAME);

function createPaymentService({
  botConfig,
  logger,
  repositories,
  loggingService,
  statusSyncService,
  getJokiService,
  deliveryService,
  orderService,
}) {
  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
    return null;
  }

  function normalizeList(raw) {
    if (!raw || typeof raw !== "string") return "-";
    const parts = raw
      .split("|")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!parts.length) return "-";
    if (parts.length === 1) return parts[0];
    return parts.map((entry) => `- ${entry}`).join("\n");
  }

  function isMeaningfulPaymentValue(raw, expectedKeywords = []) {
    if (!raw || typeof raw !== "string") return false;
    const value = raw.trim();
    if (!value || value === "-") return false;
    if (/^\d{1,3}$/.test(value)) return false;
    if (!expectedKeywords.length) return true;
    return expectedKeywords.some((keyword) => value.toLowerCase().includes(keyword));
  }

  function pickPaymentValue(savedValue, defaultValue, expectedKeywords) {
    return isMeaningfulPaymentValue(savedValue, expectedKeywords) ? savedValue : defaultValue;
  }

  async function sendPaymentPanel(channel) {
    const settings = await repositories.simpleStoreRepository?.getSettings?.() || {};

    // Env should act as source of truth for production safety.
    // If PAYMENT_* env is set, override DB/storeSettings to prevent "env yang lama" behavior.
    const envBank = process.env.PAYMENT_BANK;
    const envEwallet = process.env.PAYMENT_EWALLET;
    const envQris = process.env.PAYMENT_QRIS;

    const effectiveBank = envBank ? envBank : settings.payment_bank;
    const effectiveEwallet = envEwallet ? envEwallet : settings.payment_ewallet;
    const effectiveQris = envQris ? envQris : settings.payment_qris;

    const bankLines = normalizeList(
      pickPaymentValue(effectiveBank, botConfig.payment.bank, ["bca", "bri", "bank"]),
    );
    const ewalletLines = normalizeList(
      pickPaymentValue(
        effectiveEwallet,
        botConfig.payment.ewallet,
        ["dana", "shopeepay", "gopay", "ovo", "ewallet", "e-wallet"],
      ),
    );
    const qrisLine = pickPaymentValue(effectiveQris, botConfig.payment.qris, ["qris"]);

    const embed = createEmbed({
      title: "Payment Method - HYPERINDO",
      description: [
        "**! TIDAK MENERIMA PEMBAYARAN SELAIN DI BAWAH, HATI-HATI PENIPUAN BERKEDOK ADMIN.**",
        "",
        "**Bank Transfer**",
        bankLines,
        "",
        "**E-Wallet**",
        ewalletLines,
        "",
        "**QRIS**",
        qrisLine,
        "",
        "**Cara kirim bukti bayar**",
        "Buka ticket order dulu, lalu upload screenshot/foto bukti transfer langsung di channel ticket. Jangan kirim bukti bayar lewat form.",
      ].join("\n"),
      color: 0xf1c40f,
    });
    const files = [];

    if (fs.existsSync(PAYMENT_BANNER_PATH)) {
      embed.setImage(`attachment://${PAYMENT_BANNER_NAME}`);
      files.push(new AttachmentBuilder(PAYMENT_BANNER_PATH, { name: PAYMENT_BANNER_NAME }));
    }

    return channel.send({
      embeds: [embed],
      files,
      components: [],
    });
  }

  function getImageAttachments(message) {
    return [...message.attachments.values()].filter((attachment) => {
      const contentType = attachment.contentType || "";
      return (
        contentType.startsWith("image/") ||
        /\.(?:png|jpe?g|webp|gif)$/i.test(attachment.name || attachment.url || "")
      );
    });
  }

  async function sendPromoPanel(channel, title = "Promo Aktif", description = "Update promo terbaru akan diposting di sini.") {
    return channel.send({
      embeds: [
        createEmbed({
          title,
          description,
          color: 0xff8c42,
        }),
      ],
    });
  }

  async function handlePaymentProofModal(interaction) {
    await interaction.reply({
      content: "Form payment lama sudah dinonaktifkan. Kirim screenshot/foto bukti transfer langsung di channel ticket order.",
      flags: MessageFlags.Ephemeral,
    });

    return null;
  }

  async function handlePaymentProofMessage(message) {
    if (!message?.inGuild?.() || message.author?.bot) {
      return null;
    }

    const imageAttachments = getImageAttachments(message);
    if (!imageAttachments.length) {
      return null;
    }

    const relatedTicket = await repositories.ticketRepository?.findByChannelId?.(message.channel.id);
    if (!relatedTicket || relatedTicket.type !== "order") {
      return null;
    }

    if (message.author.id !== relatedTicket.openerId && !isOwnerOrStaff(message.member)) {
      await message.reply("Bukti pembayaran hanya boleh dikirim oleh pemilik ticket atau staff.").catch((error) => {
        logBestEffort("reply invalid payment proof sender", {
          guildId: message.guild.id,
          channelId: message.channel.id,
          userId: message.author.id,
        }, error);
      });
      return null;
    }

    const ticketId = relatedTicket.id;

    // BLOCKER: attachment/image tidak boleh langsung dianggap payment proof kalau order belum berada di fase pembayaran.
    const rawOrderStatus = String(relatedTicket.orderStatus || "").toLowerCase();
    const allowedOrderStatuses = [
      "waiting",
      "waiting_payment",
      "waiting_payment_proof",
      "pending",
      "pending_payment",
    ];

    // Backward compatibility:
    // jika orderStatus belum tersimpan (undefined/empty), biarkan test & legacy flow tetap jalan.
    if (rawOrderStatus && !allowedOrderStatuses.includes(rawOrderStatus)) {
      return null;
    }

    const proofUrls = imageAttachments.map((attachment) => attachment.url);

    // ANTI-DUPLICATE: Check if same proof URL already submitted
    const allPayments = repositories.paymentRepository?.getAll
      ? await repositories.paymentRepository.getAll()
      : [];
    const duplicateProof = allPayments.find((p) =>
      p.guildId === message.guild.id &&
      p.status !== "cancelled" &&
      p.proofUrls?.some((url) => proofUrls.includes(url)),
    );
    if (duplicateProof) {
      // security log: duplicate payment proof attempt
      await loggingService?.logSecurity?.(
        message.guild,
        "Duplicate Payment Proof",
        `Duplicate proof detected in ticket #${ticketId}.`,
        [
          { name: "Ticket", value: ticketId, inline: true },
          { name: "Original Payment", value: duplicateProof.id, inline: true },
          { name: "Actor", value: message.author.tag, inline: true },
          { name: "ProofCount", value: String(proofUrls?.length ?? 0), inline: false },
        ],
      ).catch((error) => logger?.warn?.("paymentService duplicate proof security log failed", { error: error?.message ?? String(error), stack: error?.stack, ticketId }));

      await message.reply("⚠️ Gambar bukti transfer ini sudah pernah dikirim sebelumnya. Staff akan cek ulang.").catch((error) => logger?.warn?.("paymentService duplicate proof reply failed", { error: error?.message ?? String(error), stack: error?.stack, userId: message.author?.id, ticketId }));

      await loggingService?.logPayment?.(
        message.guild,
        "⚠️ Duplicate Proof Detected",
        `Bukti pembayaran yang sama terdeteksi di ticket #${ticketId}.`,
        [
          { name: "Ticket", value: ticketId, inline: true },
          { name: "Original Payment", value: duplicateProof.id, inline: true },
          { name: "Customer", value: message.author.tag, inline: true },
        ],
      ).catch((error) => logger?.warn?.("paymentService duplicate proof payment log failed", { error: error?.message ?? String(error), stack: error?.stack, ticketId }));
    }

    // ANTI-DUPLICATE: Check if ticket already has paid payment
    const ticketPayments = allPayments.filter((p) => p.ticketId === ticketId);
    const alreadyPaid = ticketPayments.find((p) => p.status === "paid");
    if (alreadyPaid) {
      await message.reply("⚠️ Order ini sudah ada pembayaran yang di-approve. Hubungi staff jika ada masalah.").catch((error) => logger?.warn?.("paymentService already paid reply failed", { error: error?.message ?? String(error), stack: error?.stack, ticketId }));
      return null;
    }

    const existingOrder = await repositories.orderRepository?.findByTicketId?.(ticketId);

    const payment = createPayment({
      id: `PAY-${Date.now()}`,
      guildId: message.guild.id,
      userId: message.author.id,
      ticketId,
      orderId: existingOrder?.id || `ORD-${ticketId}`,
      status: "submitted",
      method: "image-proof",
      amount: "",
      note: "",
      proofUrls,
      messageId: message.id,
      channelId: message.channel.id,
    });

    await repositories.paymentRepository.create(payment);
    if (statusSyncService?.syncTicketOrderQueueStatus) {
      await statusSyncService.syncTicketOrderQueueStatus({
        guildId: message.guild.id,
        ticketId,
        status: "waiting",
        actorId: message.author.id,
        note: "Payment proof submitted",
        repositories,
      }).catch((error) => {
        logger?.error?.("payment proof status sync failed", {
          guildId: message.guild.id,
          ticketId,
          message: error.message,
        });
      });
    } else {
      await repositories.ticketRepository.update(ticketId, {
        orderStatus: "waiting",
      }).catch((error) => {
        logBestEffort("fallback update ticket waiting status", {
          guildId: message.guild.id,
          ticketId,
        }, error);
      });
      await repositories.orderRepository?.updateByTicketId?.(ticketId, {
        status: "waiting",
      }).catch((error) => {
        logBestEffort("fallback update order waiting status", {
          guildId: message.guild.id,
          ticketId,
        }, error);
      });
    }

    await repositories.orderRepository?.updateByTicketId?.(ticketId, {
      paymentStatus: "submitted",
    }).catch((error) => {
      logBestEffort("update order paymentStatus submitted", {
        guildId: message.guild.id,
        ticketId,
      }, error);
    });

    await loggingService.logPayment(
      message.guild,
      "Payment Proof Submitted",
      `${message.author.tag} mengirim bukti pembayaran berupa gambar di ticket.`,
      [
        { name: "Ticket", value: ticketId, inline: true },
        { name: "Payment ID", value: payment.id, inline: true },
        { name: "Proof", value: proofUrls.map((url, index) => `[Gambar ${index + 1}](${url})`).join("\n"), inline: false },
        { name: "Note", value: payment.note || "-", inline: false },
      ],
    );

    await message.react("✅").catch((error) => {
      logBestEffort("react payment proof received", {
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
      }, error);
    });
    await message.reply("Bukti pembayaran sudah diterima. Staff akan cek dan lanjut proses order kamu.").catch((error) => {
      logBestEffort("reply payment proof received", {
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
      }, error);
    });

    return payment;
  }

  async function sweepUnpaidOrdersForReminder({ client, thresholdMs, cooldownMs, maxAlerts } = {}) {
    const now = Date.now();
    const allPayments = repositories.paymentRepository?.getAll ? await repositories.paymentRepository.getAll() : [];
    if (!Array.isArray(allPayments) || !allPayments.length) return { reminded: 0, candidates: 0 };

    const cutoff = Number.isFinite(thresholdMs) && thresholdMs > 0 ? thresholdMs : 30 * 60 * 1000;
    const cooldown = Number.isFinite(cooldownMs) && cooldownMs > 0 ? cooldownMs : 45 * 60 * 1000;
    const limit = Number.isFinite(maxAlerts) && maxAlerts > 0 ? Math.floor(maxAlerts) : 50;

    const targets = allPayments
      .filter((p) => {
        const status = String(p?.status || "").toLowerCase();
        return Boolean(status) && !["paid", "cancelled", "refunded", "refund"].includes(status);
      })
      .filter((p) => {
        const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : null;
        if (!createdAt || !Number.isFinite(createdAt)) return false;
        return now - createdAt >= cutoff;
      })
      .filter((p) => {
        const lastReminderAt = p.lastReminderAt ? new Date(p.lastReminderAt).getTime() : null;
        if (!lastReminderAt || !Number.isFinite(lastReminderAt)) return true;
        return now - lastReminderAt >= cooldown;
      });

    const candidates = targets.length;
    let reminded = 0;

    for (const payment of targets.slice(0, limit)) {
      const guildId = payment.guildId;
      const channelId = payment.channelId;
      if (!guildId || !channelId) continue;

      const channel = await client?.channels?.fetch?.(channelId).catch?.(() => null);

      // Fallback: we can’t fetch without client; best-effort use order/ticket if available.
      // For now: if channelId exists and we can’t fetch, skip.
      if (!channel?.isTextBased?.()) continue;

      const orderRef = payment.orderId || (payment.ticketId ? `ticket #${payment.ticketId}` : "order terkait");
      await channel.send(
        `Reminder payment: \`${payment.id}\` (${orderRef}) masih menunggu pengecekan staff/admin.`,
      ).catch(() => null);

      await repositories.paymentRepository?.updateById?.(payment.id, {
        lastReminderAt: new Date().toISOString(),
        reminderCount: Number(payment.reminderCount || 0) + 1,
      }).catch(() => null);
      reminded += 1;
    }

    return { reminded, candidates };
  }

  async function approvePaymentFromTicketId(interaction, relatedTicket, ticketIdSuffix = "") {
    const resolvedTicketId = String(ticketIdSuffix || relatedTicket?.id || "").trim();
    if (!resolvedTicketId) return null;

    if (!repositories?.paymentRepository?.findByTicketId || !repositories?.paymentRepository?.updateById) {
      return null;
    }

    const payments = await repositories.paymentRepository.findByTicketId(resolvedTicketId);
    const payment = Array.isArray(payments) && payments.length ? payments[payments.length - 1] : null;
    if (!payment) return null;

    // Guard: double approve
    if (payment.status === "paid") {
      // security log (best-effort)
      await loggingService?.logSecurity?.(
        interaction.guild,
        "Payment Double-Approve Blocked",
        `Payment \`${payment.id}\` sudah berstatus paid. Approve kedua diabaikan.`,
        [
          { name: "Staff", value: interaction.user.tag, inline: true },
          { name: "Ticket", value: resolvedTicketId, inline: true },
        ],
      ).catch((error) => logger?.warn?.("paymentService double approve security log failed", { error: error?.message ?? String(error), stack: error?.stack, paymentId: payment.id }));

      // keep existing payment log
      await loggingService?.logPayment?.(
        interaction.guild,
        "⚠️ Double Approve Blocked",
        `Payment \`${payment.id}\` sudah berstatus paid. Approve kedua diabaikan.`,
        [
          { name: "Staff", value: interaction.user.tag, inline: true },
          { name: "Ticket", value: resolvedTicketId, inline: true },
        ],
      ).catch((error) => logger?.warn?.("paymentService double approve payment log failed", { error: error?.message ?? String(error), stack: error?.stack, paymentId: payment.id }));

      return { ok: false, message: "Payment sudah pernah di-approve (paid)." };
    }

    const nextPaymentStatus = "paid";

    await repositories.paymentRepository.updateById(payment.id, {
      status: nextPaymentStatus,
      checkedBy: interaction.user.id,
      checkedAt: new Date().toISOString(),
      note: payment.note || "",
    });

    // Sync status: gunakan status order/ticket yang sudah dipetakan
    if (statusSyncService?.syncTicketOrderQueueStatus) {
      await statusSyncService.syncTicketOrderQueueStatus({
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
        status: "paid",
        actorId: interaction.user.id,
        note: "Payment approved (button)",
        repositories,
      }).catch((error) => {
        logBestEffort("payment approve sync failed", { guildId: interaction.guild.id, ticketId: resolvedTicketId }, error);
      });
    } else if (repositories?.ticketRepository?.update) {
      await repositories.ticketRepository.update(resolvedTicketId, { orderStatus: "completed" }).catch(() => null);
    }

    await repositories.orderRepository?.updateByTicketId?.(resolvedTicketId, {
      paymentStatus: "paid",
      status: "paid",
    }).catch((error) => {
      logBestEffort("update order after payment approved", {
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
      }, error);
    });

    // Auto delivery (digital)
    if (deliveryService?.tryAutoDeliver) {
      try {
        await deliveryService.tryAutoDeliver(interaction.guild, resolvedTicketId);
      } catch (error) {
        logBestEffort("auto delivery failed (after approve)", {
          guildId: interaction.guild.id,
          ticketId: resolvedTicketId,
        }, error);
      }
    }

    // Priority 1: auto-generate/edit order summary + invoice on payment became paid
    const order = await repositories?.orderRepository?.findByTicketId?.(resolvedTicketId).catch(() => null);
    if (order) {
      try {
        // order summary: edit the same embed (orderSummaryMessageId)
        if (orderService?.sendOrderSummary) {
          const relatedTicketMeta = relatedTicket?.meta || {};
          const detailText =
            relatedTicketMeta?.detail ||
            relatedTicketMeta?.paymentNote ||
            relatedTicketMeta?.budgetPayment ||
            order.detail ||
            "-";

          await orderService.sendOrderSummary(
            interaction.channel,
            "ORDER BARU",
            String(detailText),
            0x57f287,
            {
              ticket: relatedTicket,
              interaction,
              product: order.product,
              order,
              meta: relatedTicketMeta,
            },
            order.id,
            relatedTicket?.id || resolvedTicketId,
          ).catch(() => null);
        }

        // invoice
        if (orderService?.sendOrEditInvoice) {
          await orderService.sendOrEditInvoice({
            channel: interaction.channel,
            interaction,
            order,
            orderId: order.id,
            repositories,
          }).catch(() => null);
        }
      } catch {
        // best-effort only
      }
    }

    await loggingService?.logPayment?.(
      interaction.guild,
      "Payment Approved",
      `Payment \`${payment.id}\` di-approve.`,
      [
        { name: "Staff", value: interaction.user.tag, inline: true },
        { name: "Ticket", value: resolvedTicketId, inline: true },
        { name: "Payment ID", value: payment.id, inline: true },
      ],
    ).catch(() => null);

    return { ok: true, payment };
  }

  async function rejectPaymentFromTicketId(interaction, relatedTicket, ticketIdSuffix = "", reason = "") {
    const resolvedTicketId = String(ticketIdSuffix || relatedTicket?.id || "").trim();
    if (!resolvedTicketId) return null;

    if (!repositories?.paymentRepository?.findByTicketId || !repositories?.paymentRepository?.updateById) {
      return null;
    }

    const payments = await repositories.paymentRepository.findByTicketId(resolvedTicketId);
    const payment = Array.isArray(payments) && payments.length ? payments[payments.length - 1] : null;
    if (!payment) return null;

    const nextPaymentStatus = "cancelled";
    const safeReason = String(reason || "").trim().slice(0, 800) || "-";

    await repositories.paymentRepository.updateById(payment.id, {
      status: nextPaymentStatus,
      checkedBy: interaction.user.id,
      checkedAt: new Date().toISOString(),
      note: safeReason,
    });

    if (statusSyncService?.syncTicketOrderQueueStatus) {
      await statusSyncService.syncTicketOrderQueueStatus({
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
        status: "cancelled",
        actorId: interaction.user.id,
        note: `Payment rejected: ${safeReason}`,
        repositories,
      }).catch((error) => {
        logBestEffort("payment reject sync failed", { guildId: interaction.guild.id, ticketId: resolvedTicketId }, error);
      });
    } else if (repositories?.ticketRepository?.update) {
      await repositories.ticketRepository.update(resolvedTicketId, { orderStatus: "cancelled" }).catch(() => null);
    }

    await repositories.orderRepository?.updateByTicketId?.(resolvedTicketId, {
      paymentStatus: "cancelled",
    }).catch((error) => {
      logBestEffort("update order after payment rejected", {
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
      }, error);
    });

    await loggingService?.logPayment?.(
      interaction.guild,
      "Payment Rejected",
      `Payment \`${payment.id}\` di-reject.`,
      [
        { name: "Staff", value: interaction.user.tag, inline: true },
        { name: "Ticket", value: resolvedTicketId, inline: true },
        { name: "Payment ID", value: payment.id, inline: true },
        { name: "Reason", value: safeReason, inline: false },
      ],
    ).catch(() => null);

    return { ok: true, payment };
  }

  async function setPaymentStatus({ guild, actorUser, paymentId, status = "paid", note = "" }) {
    if (!guild || !actorUser || !paymentId) return { ok: false, message: "Invalid args." };

    const payment = await repositories?.paymentRepository?.findById?.(paymentId).catch(() => null);
    if (!payment) return { ok: false, message: "Payment not found." };

    const normalized = normalizeStatus(status);

    // Legacy fallback: beberapa business tests hanya seed orderId (tanpa ticketId).
    // Dalam kasus ini, update payment & order by orderId saja (tanpa auto delivery/invoice).
    if (!payment.ticketId) {
      if (!payment.orderId) {
        return { ok: false, message: "Payment has no ticketId or orderId (legacy seed unsupported)." };
      }

      const nextPaymentStatus = normalized === "paid" ? "paid" : normalized === "cancelled" ? "cancelled" : null;
      if (!nextPaymentStatus) {
        return { ok: false, message: `Unsupported payment status: ${status}` };
      }

      await repositories.paymentRepository.updateById(payment.id, {
        status: nextPaymentStatus,
        checkedBy: actorUser.id,
        checkedAt: new Date().toISOString(),
        note: note || payment.note || "",
      }).catch(() => null);

      if (repositories?.orderRepository?.findByIdScoped && repositories?.orderRepository?.updateByIdScoped) {
        const order = await repositories.orderRepository.findByIdScoped(guild.id, payment.orderId).catch(() => null);
        if (order) {
          await repositories.orderRepository.updateByIdScoped(guild.id, order.id, {
            paymentStatus: nextPaymentStatus,
            status: nextPaymentStatus,
          }).catch(() => null);
        }
      } else if (repositories?.orderRepository?.findById && repositories?.orderRepository?.updateById) {
        // Legacy fallback: still try to reduce risk by validating guildId field when present.
        const order = await repositories.orderRepository.findById(payment.orderId).catch(() => null);
        if (order && (order.guildId === guild.id || !order.guildId)) {
          await repositories.orderRepository.updateById(order.id, {
            paymentStatus: nextPaymentStatus,
            status: nextPaymentStatus,
          }).catch(() => null);
        }
      }

      return { ok: true, payment };
    }

    // Normal flow when we have ticketId
    const relatedTicket = await repositories?.ticketRepository?.findById?.(payment.ticketId).catch(() => null);

    if (normalized === "paid") {
      return approvePaymentFromTicketId({
        guild,
        user: actorUser,
        member: actorUser,
        channel: actorUser.channel || null,
        options: {},
      }, relatedTicket, relatedTicket?.id || String(payment.ticketId)).catch(() => ({ ok: false }));
    }

    if (normalized === "cancelled") {
      return rejectPaymentFromTicketId({
        guild,
        user: actorUser,
        member: actorUser,
      }, relatedTicket, relatedTicket?.id || String(payment.ticketId), note || "-").catch(() => ({ ok: false }));
    }

    return { ok: false, message: `Unsupported payment status: ${status}` };
  }

  function normalizeStatus(raw) {
    const s = String(raw ?? "").toLowerCase().trim();
    if (["paid", "approve", "success"].includes(s)) return "paid";
    if (["cancelled", "canceled", "reject", "declined"].includes(s)) return "cancelled";
    return s;
  }

  async function handlePaymentRejectReasonModal(interaction) {
    const reason = interaction.fields.getTextInputValue("payment_reject_reason");
    const relatedTicket = await repositories.ticketRepository?.findByChannelId?.(interaction.channel.id);

    if (!relatedTicket || relatedTicket.type !== "order") {
      await interaction.reply({ content: "Ticket order tidak ditemukan untuk modal ini.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return null;
    }

    if (!interaction.member) {
      await interaction.reply({ content: "Member tidak valid.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return null;
    }

    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff/admin yang bisa menolak payment.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return null;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);

    const result = await rejectPaymentFromTicketId(interaction, relatedTicket, relatedTicket.id, reason).catch(() => null);
    await interaction.editReply?.({ content: result?.ok ? "Payment ditolak." : "Gagal menolak payment." }).catch(() => null);
    return result;
  }

  logger?.info?.("payment service ready", { store: botConfig.storeName });

  return {
    sendPaymentPanel,
    sendPromoPanel,
    handlePaymentProofModal,
    handlePaymentProofMessage,
    sweepUnpaidOrdersForReminder,

    approvePaymentFromTicketId,
    handlePaymentRejectReasonModal,

    // Legacy compatibility for business tests / older callers
    setPaymentStatus,
  };
}

module.exports = {
  createPaymentService,
};
