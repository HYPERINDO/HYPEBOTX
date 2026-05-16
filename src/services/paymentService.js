const fs = require("fs");
const path = require("path");
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { createPayment } = require("../database/models/Payment");
const { createEmbed } = require("../utils/embed");
const { isOwnerOrStaff } = require("../utils/permissionCheck");
const { componentIds } = require("../utils/constants");
const channelConfig = require("../config/channels");
const { normalizeTextChannelName } = require("../utils/normalizeName");

const PAYMENT_BANNER_NAME = "payment-method-banner.png";
const PAYMENT_BANNER_PATH = path.join(__dirname, "..", "assets", PAYMENT_BANNER_NAME);
const DEFAULT_PAYMENT_REVIEW_CHANNEL_ID = "1503411881820295251";

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

  function buildAdminConfirmComponents() {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(componentIds.orderAdminConfirm)
          .setLabel("Konfirmasi Admin")
          .setStyle(ButtonStyle.Primary),
      ),
    ];
  }

  function buildPaymentConfirmComponents(ticketId) {
    if (!ticketId) return [];
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${componentIds.paymentApprovePrefix}${ticketId}`)
          .setLabel("Konfirmasi Pembayaran (Admin)")
          .setStyle(ButtonStyle.Success),
      ),
    ];
  }

  function shouldAutoQueueJoki(ticket) {
    const formType = String(ticket?.meta?.formType || "").toLowerCase();
    return ["joki", "gta"].includes(formType);
  }

  async function publishQueueListFromSync(guild, syncResult, action = "queue-update") {
    const queueOrderId = String(syncResult?.queueOrderId || "").trim();
    if (!guild || !queueOrderId) return null;
    if (!repositories?.jokiRepository?.getOrderById) return null;

    const jokiService = typeof getJokiService === "function" ? getJokiService() : null;
    if (!jokiService?.publishQueueUpdate) return null;

    const queueOrder = await repositories.jokiRepository.getOrderById(guild.id, queueOrderId).catch((error) => {
      logBestEffort("fetch queue order for queue-list publish", {
        guildId: guild.id,
        queueOrderId,
      }, error);
      return null;
    });
    if (!queueOrder) return null;

    return jokiService.publishQueueUpdate(guild, queueOrder, action).catch((error) => {
      logBestEffort("publish queue-list from payment flow", {
        guildId: guild.id,
        queueOrderId,
        action,
      }, error);
      return null;
    });
  }

  function getPaymentReviewChannelId() {
    return String(
      process.env.PAYMENT_REVIEW_CHANNEL_ID ||
      process.env.PAYMENT_LOG_CHANNEL_ID ||
      DEFAULT_PAYMENT_REVIEW_CHANNEL_ID,
    ).trim();
  }

  function listPaymentReviewChannelNames() {
    const rawCandidates = [
      process.env.PAYMENT_REVIEW_CHANNEL_NAME,
      process.env.PAYMENT_LOG_CHANNEL_NAME,
      channelConfig?.logChannels?.payment,
      "payment-logs",
      "payment-log",
      "order-logs",
    ];
    const unique = new Set();
    for (const entry of rawCandidates) {
      const value = String(entry || "").trim();
      if (!value) continue;
      unique.add(value);
    }
    return [...unique];
  }

  async function resolveTextChannelById(guild, channelId) {
    if (!guild || !channelId) return null;
    const fromCache = guild.channels?.cache?.get?.(channelId);
    if (fromCache?.isTextBased?.()) return fromCache;
    const fetched = await guild.channels?.fetch?.(channelId).catch(() => null);
    if (fetched?.isTextBased?.()) return fetched;
    return null;
  }

  function resolveTextChannelByName(guild, channelName) {
    if (!guild?.channels?.cache || !channelName) return null;
    const targetRaw = String(channelName || "").trim();
    if (!targetRaw) return null;
    const target = normalizeTextChannelName(targetRaw);
    for (const channel of guild.channels.cache.values()) {
      if (!channel?.isTextBased?.()) continue;
      const currentName = String(channel.name || "");
      if (currentName === targetRaw) return channel;
      if (normalizeTextChannelName(currentName) === target) return channel;
    }
    return null;
  }

  async function resolvePaymentReviewChannel(guild) {
    const channelById = await resolveTextChannelById(guild, getPaymentReviewChannelId());
    if (channelById) return channelById;

    for (const channelName of listPaymentReviewChannelNames()) {
      const channelByName = resolveTextChannelByName(guild, channelName);
      if (channelByName) return channelByName;
    }
    return null;
  }

  async function notifyPaymentReviewChannel({
    message,
    ticketId,
    payment,
    proofUrls,
    relatedTicket,
    existingOrder,
  }) {
    const reviewChannel = await resolvePaymentReviewChannel(message?.guild);
    if (!reviewChannel) return null;

    const openerMention = relatedTicket?.openerId ? `<@${relatedTicket.openerId}>` : `<@${message.author.id}>`;
    const ticketMention = relatedTicket?.channelId ? `<#${relatedTicket.channelId}>` : "`(ticket channel tidak ditemukan)`";
    const productLabel = existingOrder?.product || existingOrder?.category || "-";
    const packageLabel = existingOrder?.packageName || existingOrder?.package || "-";
    const flowLabel = String(relatedTicket?.meta?.orderFlowStatus || "MENUNGGU KONFIRMASI");
    const proofList = proofUrls?.length
      ? proofUrls.map((url, index) => `[Bukti ${index + 1}](${url})`).join("\n")
      : "-";

    const embed = createEmbed({
      title: `Payment Proof - Ticket #${ticketId}`,
      description: [
        `${openerMention} mengirim bukti transfer.`,
        "",
        `**Ticket:** ${ticketMention}`,
        `**Order ID:** ${existingOrder?.id || payment?.orderId || "-"}`,
        `**Produk/Paket:** ${productLabel} / ${packageLabel}`,
        `**Flow Status:** ${flowLabel}`,
        "",
        `**Bukti Transfer:**`,
        proofList,
      ].join("\n"),
      color: 0xf1c40f,
      footer: message.guild?.name || "HYPERINDO",
    });

    return reviewChannel.send({
      embeds: [embed],
      components: buildPaymentConfirmComponents(ticketId),
    }).catch(() => null);
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
    const { safeReply } = require("../utils/discordResponse");
    await safeReply(interaction, {
      content: "Form payment lama sudah dinonaktifkan. Kirim screenshot/foto bukti transfer langsung di channel ticket order.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);

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
    const existingOrder = await repositories.orderRepository?.findByTicketId?.(ticketId);

    const checkoutMeta = relatedTicket?.meta?.checkout || {};
    const strictCheckoutFlow =
      Number(relatedTicket?.meta?.checkoutFlowVersion || checkoutMeta?.version || 0) >= 2;
    const invoiceReady = Boolean(
      relatedTicket?.meta?.invoiceReady ||
      checkoutMeta?.invoiceReady ||
      existingOrder?.checkoutSummary,
    );

    if (strictCheckoutFlow && !invoiceReady) {
      await message.reply("Lengkapi checkout dan konfirmasi invoice dulu sebelum upload bukti pembayaran.").catch(() => null);
      return null;
    }

    const flowStatus = String(relatedTicket?.meta?.orderFlowStatus || "").toUpperCase();
    if (strictCheckoutFlow && flowStatus === "MENUNGGU ADMIN") {
      await message.reply({
        content: "Order ini masih menunggu admin (cek detail/custom/stok). Jangan transfer dulu sampai admin konfirmasi.",
        components: buildAdminConfirmComponents(),
      }).catch(() => null);
      return null;
    }

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

    const nextTicketMeta = {
      ...(relatedTicket.meta || {}),
      orderFlowStatus: "MENUNGGU KONFIRMASI",
    };
    if (strictCheckoutFlow || relatedTicket?.meta?.checkout) {
      nextTicketMeta.checkout = {
        ...(relatedTicket?.meta?.checkout || {}),
        invoiceReady: invoiceReady || Boolean(relatedTicket?.meta?.checkout?.invoiceReady),
      };
    }

    await repositories.ticketRepository?.update?.(ticketId, {
      meta: nextTicketMeta,
    }).catch((error) => {
      logBestEffort("update ticket flow status after payment proof", {
        guildId: message.guild.id,
        ticketId,
      }, error);
    });

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

    await notifyPaymentReviewChannel({
      message,
      ticketId,
      payment,
      proofUrls,
      relatedTicket,
      existingOrder,
    }).catch((error) => {
      logBestEffort("forward payment proof to review channel", {
        guildId: message.guild.id,
        ticketId,
        paymentId: payment.id,
      }, error);
    });

    await message.react("✅").catch((error) => {
      logBestEffort("react payment proof received", {
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
      }, error);
    });
    await message.reply({
      content: "Bukti pembayaran sudah diterima. Staff akan cek dan lanjut proses order kamu.",
      components: buildPaymentConfirmComponents(ticketId),
    }).catch((error) => {
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
    let syncResult = null;
    if (statusSyncService?.syncTicketOrderQueueStatus) {
      syncResult = await statusSyncService.syncTicketOrderQueueStatus({
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
        status: "paid",
        actorId: interaction.user.id,
        note: "Payment approved (button)",
        repositories,
      }).catch((error) => {
        logBestEffort("payment approve sync failed", { guildId: interaction.guild.id, ticketId: resolvedTicketId }, error);
        return null;
      });
    } else if (repositories?.ticketRepository?.update) {
      await repositories.ticketRepository.update(resolvedTicketId, { orderStatus: "processing" }).catch(() => null);
    }

    if (!statusSyncService?.syncTicketOrderQueueStatus && shouldAutoQueueJoki(relatedTicket)) {
      const jokiService = typeof getJokiService === "function" ? getJokiService() : null;
      if (jokiService?.startQueue) {
        await jokiService.startQueue({
          guild: interaction.guild,
          user: {
            id: interaction.user.id,
            tag: interaction.user.tag,
          },
        }, {
          ticketId: resolvedTicketId,
          publishAction: "payment-accepted",
        }).catch((error) => {
          logBestEffort("auto queue joki after payment approve (fallback)", {
            guildId: interaction.guild.id,
            ticketId: resolvedTicketId,
          }, error);
        });
      }
    }

    await repositories.ticketRepository?.update?.(resolvedTicketId, {
      meta: {
        ...(relatedTicket?.meta || {}),
        orderFlowStatus: "DIPROSES",
        checkout: {
          ...(relatedTicket?.meta?.checkout || {}),
          invoiceReady: true,
        },
      },
    }).catch((error) => {
      logBestEffort("update ticket flow status after payment approve", {
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
      }, error);
    });

    await repositories.orderRepository?.updateByTicketId?.(resolvedTicketId, {
      paymentStatus: "paid",
      status: "paid",
    }).catch((error) => {
      logBestEffort("update order after payment approved", {
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
      }, error);
    });

    await publishQueueListFromSync(interaction.guild, syncResult, "payment-accepted");

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

    const ticketChannel = await resolveTextChannelById(interaction?.guild, relatedTicket?.channelId).catch(() => null);
    const targetOrderChannel = ticketChannel?.isTextBased?.() ? ticketChannel : interaction?.channel;

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
            targetOrderChannel,
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
            channel: targetOrderChannel,
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

    let syncResult = null;
    if (statusSyncService?.syncTicketOrderQueueStatus) {
      syncResult = await statusSyncService.syncTicketOrderQueueStatus({
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
        status: "cancelled",
        actorId: interaction.user.id,
        note: `Payment rejected: ${safeReason}`,
        repositories,
      }).catch((error) => {
        logBestEffort("payment reject sync failed", { guildId: interaction.guild.id, ticketId: resolvedTicketId }, error);
        return null;
      });
    } else if (repositories?.ticketRepository?.update) {
      await repositories.ticketRepository.update(resolvedTicketId, { orderStatus: "cancelled" }).catch(() => null);
    }

    await repositories.ticketRepository?.update?.(resolvedTicketId, {
      meta: {
        ...(relatedTicket?.meta || {}),
        orderFlowStatus: "DIBATALKAN",
      },
    }).catch((error) => {
      logBestEffort("update ticket flow status after payment reject", {
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
      }, error);
    });

    await repositories.orderRepository?.updateByTicketId?.(resolvedTicketId, {
      paymentStatus: "cancelled",
    }).catch((error) => {
      logBestEffort("update order after payment rejected", {
        guildId: interaction.guild.id,
        ticketId: resolvedTicketId,
      }, error);
    });

    await publishQueueListFromSync(interaction.guild, syncResult, "queue-update");

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
      await safeReply(interaction, { content: "Ticket order tidak ditemukan untuk modal ini.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return null;
    }

    if (!interaction.member) {
      await safeReply(interaction, { content: "Member tidak valid.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return null;
    }

    if (!isOwnerOrStaff(interaction.member)) {
      await safeReply(interaction, { content: "Hanya staff/admin yang bisa menolak payment.", flags: MessageFlags.Ephemeral }).catch(() => null);
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
