const http = require("http");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { createEmbed } = require("../utils/embed");
const { componentIds } = require("../utils/constants");
const { isOwnerOrStaff } = require("../utils/permissionCheck");
const { safeReply } = require("../utils/discordResponse");
const { formatDateTimeInTimeZone } = require("../utils/time");
const { isPaymentTerminal } = require("../utils/paymentStatus");

function createBacklogService({
  botConfig,
  logger,
  repositories,
  loggingService,
  statusSyncService,
  orderService,
  paymentService,
}) {
  const sensitiveWarningCooldown = new Map();
  let dashboardServer = null;
  let dashboardUrl = null;

  function nowIso() {
    return formatDateTimeInTimeZone(new Date(), { timeZone: "Asia/Jakarta", label: "WIB" });
  }

  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
  }

  function normalizeCode(raw) {
    return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function normalizeCouponDiscountType(raw) {
    const type = String(raw || "").trim().toLowerCase();
    if (type === "percent" || type === "percentage" || type === "%") {
      return "percentage";
    }
    return "amount";
  }

  function parseAmount(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    const normalized = String(value).replace(/[^\d]/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.floor(parsed));
  }

  function formatCurrency(amount) {
    if (!Number.isFinite(amount)) return "-";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
  }

  function getQuickActionRows() {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(componentIds.quickActionSummary).setLabel("Order Summary").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentIds.quickActionInvoice).setLabel("Invoice").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentIds.quickActionMarkPaid).setLabel("Mark Paid").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(componentIds.quickActionMarkProcessing).setLabel("Mark Processing").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(componentIds.quickActionMarkCompleted).setLabel("Mark Done").setStyle(ButtonStyle.Success),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(componentIds.quickActionCloseTicket).setLabel("Close Ticket").setStyle(ButtonStyle.Danger),
    );
    return [row1, row2];
  }

  async function getHealthSnapshot(client) {
    const tickets = await repositories.ticketRepository?.getAll?.().catch(() => []) || [];
    const orders = await repositories.orderRepository?.getAll?.().catch(() => []) || [];
    const payments = await repositories.paymentRepository?.getAll?.().catch(() => []) || [];
    const queues = await repositories.jokiRepository?.listQueues?.().catch(() => []) || [];

    const memory = process.memoryUsage();
    const rssMb = Number(memory.rss / 1024 / 1024).toFixed(1);
    const heapUsedMb = Number(memory.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMb = Number(memory.heapTotal / 1024 / 1024).toFixed(1);

    const openTickets = tickets.filter((t) => ["open", "reopened"].includes(t.status)).length;
    const pendingOrders = orders.filter((o) => ["pending", "waiting", "queued", "processing", "hold"].includes(String(o.status || "").toLowerCase())).length;
    const pendingPayments = payments.filter((p) => !isPaymentTerminal(p.status)).length;
    const activeJoki = queues.reduce((sum, q) => sum + (q?.orders?.filter((o) => ["queued", "processing", "hold"].includes(o.status)).length || 0), 0);

    return {
      now: nowIso(),
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      guildCount: client?.guilds?.cache?.size || 0,
      commandCount: client?.commands?.size || 0,
      memory: {
        rssMb,
        heapUsedMb,
        heapTotalMb,
      },
      runtime: {
        openTickets,
        pendingOrders,
        pendingPayments,
        activeJoki,
      },
      jobs: {
        autoBackup: Boolean(client?.container?.jobs?.autoBackupJob),
        autoCloseTicket: Boolean(client?.container?.jobs?.autoCloseTicketJob),
        paymentReminder: Boolean(client?.container?.jobs?.paymentReminderJob),
        jokiQueue: Boolean(client?.container?.jobs?.jokiQueueJob),
        jokiHoldReminder: Boolean(client?.container?.jobs?.jokiHoldReminderJob),
        giveaway: Boolean(client?.container?.jobs?.giveawayJob),
        musicCleanup: Boolean(client?.container?.jobs?.musicCleanupJob),
      },
    };
  }

  async function createCoupon({
    guildId,
    code,
    discountType,
    discountValue,
    minPurchase = 0,
    maxRedemptions = 1,
    expiresAt = null,
    note = "",
    createdBy = null,
  }) {
    const safeCode = normalizeCode(code);
    if (!safeCode) {
      throw new Error("Kode coupon kosong.");
    }
    const all = await repositories.opsRepository.coupons.getAll();
    const existing = all.find((row) => row.guildId === guildId && normalizeCode(row.code) === safeCode);
    if (existing) {
      throw new Error("Kode coupon sudah ada.");
    }
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Nilai discount tidak valid.");
    }
    const type = String(discountType || "").toLowerCase();
    if (!["amount", "percentage"].includes(type)) {
      throw new Error("Tipe discount harus `amount` atau `percentage`.");
    }

    return repositories.opsRepository.coupons.create({
      guildId,
      code: safeCode,
      discountType: type,
      discountValue: type === "percentage" ? Math.min(100, Math.max(0, value)) : Math.max(0, value),
      minPurchase: Math.max(0, Number(minPurchase || 0)),
      maxRedemptions: Math.max(1, Number(maxRedemptions || 1)),
      expiresAt: expiresAt || null,
      active: true,
      note: String(note || "").trim().slice(0, 500),
      createdBy: createdBy || null,
      usageCount: 0,
      redemptions: [],
    });
  }

  async function listCoupons(guildId) {
    const rows = await repositories.opsRepository.coupons.getAll();
    return rows
      .filter((row) => row.guildId === guildId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const couponLocks = new Map();

  async function withCouponLock(code, fn) {
    const safeCode = normalizeCode(code);
    let release;
    const currentLock = couponLocks.get(safeCode) || Promise.resolve();
    const nextLock = new Promise((resolve) => {
      release = resolve;
    });
    couponLocks.set(safeCode, currentLock.then(() => nextLock));

    await currentLock.catch((error) => logger?.warn?.("Coupon lock cleanup failed", { error: error?.message ?? String(error), stack: error?.stack }));
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async function redeemCoupon({
    guildId,
    userId,
    ticketId = null,
    orderId = null,
    code,
  }) {
    const safeCode = normalizeCode(code);
    return withCouponLock(safeCode, async () => {
      const coupon = await repositories.opsRepository.coupons.findByCode(guildId, safeCode);
      if (!coupon) {
        return { ok: false, message: "Coupon tidak ditemukan." };
      }

      const order = orderId
        ? await repositories.orderRepository.findById(orderId).catch(() => null)
        : ticketId
          ? await repositories.orderRepository.findByTicketId(ticketId).catch(() => null)
          : null;

      const orderAmount = parseAmount(order?.price);
      const minPurchase = Math.max(0, Number(coupon.minPurchase || 0));
      if (Number.isFinite(orderAmount) && orderAmount < minPurchase) {
        return { ok: false, message: `Minimal pembelian coupon ini ${formatCurrency(minPurchase)}.` };
      }

      const discountType = normalizeCouponDiscountType(coupon.discountType);
      const discountValue = Number(coupon.discountValue || 0);
      let discountAmount = null;
      if (Number.isFinite(orderAmount)) {
        if (discountType === "percentage") {
          discountAmount = Math.floor(orderAmount * (Math.min(100, Math.max(0, discountValue)) / 100));
        } else {
          discountAmount = Math.min(orderAmount, Math.max(0, Math.floor(discountValue)));
        }
      }

      const redemption = {
        id: `RDM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId,
        ticketId: ticketId || order?.ticketId || null,
        orderId: order?.id || orderId || null,
        code: coupon.code,
        discountType: discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        redeemedAt: nowIso(),
      };

      let updatedCoupon;
      try {
        updatedCoupon = await repositories.opsRepository.coupons.redeemCoupon({
          guildId,
          code: safeCode,
          userId,
          redemption,
        });
      } catch (error) {
        return { ok: false, message: String(error?.message || error) };
      }

      if (order?.id) {
        const currentNote = String(order.adminNote || "").trim();
        const couponNote = `[COUPON] ${updatedCoupon.code} dipakai oleh ${userId}${discountAmount !== null ? ` | potongan ${formatCurrency(discountAmount)}` : ""}`;
        const nextNote = currentNote ? `${currentNote}\n${couponNote}` : couponNote;
        await repositories.orderRepository.updateById(order.id, { adminNote: nextNote }).catch((error) => {
          logBestEffort("update order note with coupon", { guildId, orderId: order.id }, error);
        });
      }

      if (ticketId) {
        const ticket = await repositories.ticketRepository.findById(ticketId).catch(() => null);
        if (ticket) {
          await repositories.ticketRepository.update(ticket.id, {
            meta: {
              ...(ticket.meta || {}),
              couponCode: updatedCoupon.code,
              couponRedeemedAt: redemption.redeemedAt,
              couponDiscountAmount: discountAmount,
            },
          }).catch((error) => {
            logBestEffort("update ticket coupon metadata", { guildId, ticketId }, error);
          });
        }
      }

      return { ok: true, coupon: updatedCoupon, redemption };
    });
  }

  async function submitTestimonial({
    guild,
    user,
    rating,
    message,
    orderId = null,
    ticketId = null,
    category = "general",
  }) {
    const ratingNum = Number(rating);
    const isValidInteger = Number.isInteger(ratingNum);
    if (!isValidInteger || ratingNum < 1 || ratingNum > 5) {
      return { ok: false, message: "Rating harus angka 1 sampai 5." };
    }

    const safeRating = String(ratingNum);
    const safeMessage = String(message || "").trim().slice(0, 1500);
    if (!safeMessage) {
      return { ok: false, message: "Pesan testimoni kosong." };
    }

    // Duplicate guard: reject if this user already submitted testimonial for the same order.
    if (orderId) {
      const all = await repositories.opsRepository.testimonials.getAll();
      const exists = (all || []).some((row) => row.orderId === orderId && row.userId === user.id);
      if (exists) {
        return { ok: false, message: "Testimoni untuk order ini sudah pernah dikirim." };
      }
    }

    const row = await repositories.opsRepository.testimonials.create({
      guildId: guild.id,
      userId: user.id,
      username: user.tag || user.username,
      rating: safeRating,
      message: safeMessage,
      orderId: orderId || null,
      ticketId: ticketId || null,
      category: String(category || "general"),
      approved: true,
    });

    const stars = "⭐".repeat(safeRating);
    const embed = createEmbed({
      title: "Testimoni Baru",
      color: 0x57f287,
      description: `${stars}\n\n${safeMessage}`,
      fields: [
        { name: "Customer", value: `<@${user.id}>`, inline: true },
        { name: "Order ID", value: orderId || "-", inline: true },
      ],
      footer: guild.name,
    });

    const testimonialChannel = guild.channels.cache.find((channel) => {
      if (!channel?.isTextBased?.()) return false;
      const lowered = String(channel.name || "").toLowerCase();
      return lowered.includes("testimonials") || lowered.includes("testimoni");
    });
    if (testimonialChannel) {
      await testimonialChannel.send({ embeds: [embed] }).catch((error) => {
        logBestEffort("send testimonial to channel", { guildId: guild.id, channelId: testimonialChannel.id }, error);
      });
    }

    return { ok: true, testimonial: row };
  }

  async function listTestimonials(guildId, limit = 20) {
    const rows = await repositories.opsRepository.testimonials.getAll();
    return rows
      .filter((row) => row.guildId === guildId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async function buildExportPayload(guildId, target = "all") {
    const resolved = String(target || "all").toLowerCase();
    const includeAll = resolved === "all";
    const payload = {
      exportedAt: nowIso(),
      guildId,
      target: resolved,
    };

    if (includeAll || resolved === "tickets") payload.tickets = (await repositories.ticketRepository.getAll()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "orders") payload.orders = (await repositories.orderRepository.getAll()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "payments") payload.payments = (await repositories.paymentRepository.getAll()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "joki") payload.jokiQueues = (await repositories.jokiRepository.listQueues()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "coupons") payload.coupons = (await repositories.opsRepository.coupons.getAll()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "testimonials") payload.testimonials = (await repositories.opsRepository.testimonials.getAll()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "shifts") payload.jokiShifts = (await repositories.opsRepository.jokiShifts.getAll()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "commissions") payload.jokiCommissions = (await repositories.opsRepository.jokiCommissions.getAll()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "mutations") payload.mutations = (await repositories.opsRepository.mutations.getAll()).filter((row) => row.guildId === guildId);
    if (includeAll || resolved === "terms") payload.termsAcceptances = (await repositories.opsRepository.termsAcceptances.getAll()).filter((row) => row.guildId === guildId);

    return payload;
  }

  function detectSensitiveFlags(content) {
    const raw = String(content || "");
    const lowered = raw.toLowerCase();
    const flags = [];
    if (/password|pass\s*:|kata\s*sandi|pwd/i.test(lowered)) flags.push("password");
    if (/otp|one\s*time\s*password/i.test(lowered)) flags.push("otp");
    if (/pin\s*:|pin\b/i.test(lowered)) flags.push("pin");
    if (/cvv|cvc/i.test(lowered)) flags.push("cvv");
    if (/token|auth\s*key|api\s*key/i.test(lowered)) flags.push("token");
    if (/\b\d{16}\b/.test(raw)) flags.push("possible_card_number");
    if (/\b\d{3,4}\s*[-:]\s*\d{6,}\b/.test(raw)) flags.push("possible_account_secret");
    return [...new Set(flags)];
  }

  async function handleSensitiveDataWarning(message) {
    if (!message?.inGuild?.() || message.author?.bot) return false;

    // Ignore if in ticket channel
    const isTicket = message.channel.name && (message.channel.name.startsWith("ticket-") || message.channel.name.startsWith("order-"));
    if (isTicket) return false;

    const content = String(message.content || "");
    if (!content.trim()) return false;

    const flags = detectSensitiveFlags(content);
    if (!flags.length) return false;

    const key = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
    const now = Date.now();
    const lastWarnAt = sensitiveWarningCooldown.get(key) || 0;

    // Delete message
    await message.delete().catch((error) => {
      logBestEffort("delete sensitive message", { messageId: message.id }, error);
    });

    if (now - lastWarnAt >= 60 * 1000) {
      sensitiveWarningCooldown.set(key, now);

      await repositories.opsRepository.sensitiveWarnings.create({
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
        userId: message.author.id,
        flags,
        contentPreview: content.slice(0, 200),
        warnedAt: nowIso(),
      }).catch((error) => {
        logBestEffort("store sensitive warning", {
          guildId: message.guild.id,
          channelId: message.channel.id,
          messageId: message.id,
        }, error);
      });

      const warningMsg = await message.channel.send({
        content: `<@${message.author.id}> ⚠️ **Peringatan Keamanan!**\nSistem mendeteksi pengiriman data sensitif (password/login/token) di channel publik.\nDemi keamanan, kirimkan data tersebut **hanya di dalam channel ticket (private)**. Pesan Anda telah dihapus otomatis.`
      }).catch((error) => logger?.warn?.("Failed to post sensitive warning message", { error: error?.message ?? String(error), stack: error?.stack }));

      if (warningMsg) {
        setTimeout(() => warningMsg.delete().catch((error) => logger?.warn?.("Failed to delete sensitive warning message", { error: error?.message ?? String(error), stack: error?.stack })), 15000);
      }

      await loggingService?.logModeration?.(
        message.guild,
        "Sensitive Data Warning",
        `${message.author.tag} mengirim data sensitif di channel publik. Pesan telah dihapus.`,
        [
          { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
          { name: "Flags", value: flags.join(", "), inline: true },
          { name: "Catatan", value: "Isi password tidak disimpan di log keamanan.", inline: false },
        ]
      ).catch(() => null);
    }

    return true;
  }

  function getAdminGuideLines() {
    return [
      "**Ringkas SOP Staff/Admin**",
      "1. Validasi payment proof sebelum update status.",
      "2. Gunakan quick action button di ticket untuk update cepat.",
      "3. Jika order joki HOLD terlalu lama, follow up customer/staff terkait.",
      "4. Jangan minta password/OTP/PIN di channel publik.",
      "5. Untuk refund/dispute wajib alasan yang jelas dan tercatat.",
      "6. Auto-close ticket hanya untuk ticket benar-benar tidak aktif dan tidak critical.",
      "7. Gunakan /export-data untuk audit berkala.",
      "8. Pastikan SOP/terms diterima customer sebelum lanjut order sensitif.",
    ];
  }

  async function postQuickActionPanel(interaction) {
    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    if (!ticket) {
      return { ok: false, message: "Panel quick action hanya bisa dikirim di channel ticket." };
    }

    await interaction.channel.send({
      embeds: [
        createEmbed({
          title: "Quick Action Panel",
          description: "Gunakan tombol ini untuk workflow staff/admin yang paling sering dipakai.",
          color: 0x3498db,
          fields: [
            { name: "Ticket", value: `#${ticket.id}`, inline: true },
            { name: "Type", value: ticket.type || "-", inline: true },
          ],
        }),
      ],
      components: getQuickActionRows(),
    }).catch((error) => {
      logBestEffort("send quick action panel", {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
      }, error);
    });

    return { ok: true };
  }

  async function handleQuickActionButton(interaction, actionId) {
    if (!isOwnerOrStaff(interaction.member)) {
      await safeReply(interaction, { content: "Hanya staff/admin yang bisa pakai quick action.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return null;
    }

    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    if (!ticket) {
      await safeReply(interaction, { content: "Channel ini bukan ticket.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return null;
    }

    const order = await repositories.orderRepository.findByTicketId(ticket.id).catch(() => null);
    const detailText = ticket?.meta?.detail || order?.detail || "-";

    if (actionId === componentIds.quickActionSummary) {
      if (!order) {
        await safeReply(interaction, { content: "Order belum tersedia di ticket ini.", flags: MessageFlags.Ephemeral }).catch(() => null);
        return null;
      }
      await orderService?.sendOrderSummary?.(
        interaction.channel,
        "ORDER BARU",
        String(detailText),
        0x57f287,
        {
          ticket,
          interaction,
          product: order.product,
          order,
          meta: ticket.meta || {},
        },
        order.id,
        ticket.id,
      ).catch((error) => {
        logBestEffort("quick action summary", { guildId: interaction.guild.id, ticketId: ticket.id }, error);
      });
      await safeReply(interaction, { content: "Order summary diperbarui.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return { ok: true };
    }

    if (actionId === componentIds.quickActionInvoice) {
      if (!order) {
        await safeReply(interaction, { content: "Order belum tersedia di ticket ini.", flags: MessageFlags.Ephemeral }).catch(() => null);
        return null;
      }
      await orderService?.sendOrEditInvoice?.({
        channel: interaction.channel,
        interaction,
        order,
        orderId: order.id,
        repositories,
      }).catch((error) => {
        logBestEffort("quick action invoice", { guildId: interaction.guild.id, ticketId: ticket.id }, error);
      });
      await safeReply(interaction, { content: "Invoice diperbarui.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return { ok: true };
    }

    if (actionId === componentIds.quickActionMarkPaid) {
      const result = await paymentService?.approvePaymentFromTicketId?.(interaction, ticket, ticket.id).catch((error) => {
        logBestEffort("quick action mark paid", { guildId: interaction.guild.id, ticketId: ticket.id }, error);
        return null;
      });
      await safeReply(interaction, { content: result?.ok ? "Payment ditandai PAID." : (result?.message || "Gagal mark paid."), flags: MessageFlags.Ephemeral }).catch(() => null);
      return result;
    }

    const statusByAction = {
      [componentIds.quickActionMarkProcessing]: "processing",
      [componentIds.quickActionMarkCompleted]: "completed",
    };
    if (statusByAction[actionId]) {
      const targetStatus = statusByAction[actionId];
      await statusSyncService?.syncTicketOrderQueueStatus?.({
        guildId: interaction.guild.id,
        ticketId: ticket.id,
        status: targetStatus,
        actorId: interaction.user.id,
        note: `Quick action status -> ${targetStatus}`,
        repositories,
      }).catch((error) => {
        logBestEffort("quick action status update", {
          guildId: interaction.guild.id,
          ticketId: ticket.id,
          status: targetStatus,
        }, error);
      });
      // Best-effort: publish queue update to refresh UI if joki service available
      try {
        const jokiService = interaction?.client?.container?.services?.jokiService;
        if (jokiService?.publishQueueUpdate) {
          // attempt to fetch queue order by ticketId
          const queues = await repositories.jokiRepository?.getOrderByTicketId?.(interaction.guild.id, ticket.id).catch(() => null);
          const queueOrder = Array.isArray(queues) && queues.length ? queues[0] : null;
          if (queueOrder) {
            await jokiService.publishQueueUpdate(interaction.guild, queueOrder, 'mark-done').catch(() => null);
          }
        }
      } catch (e) {
        // ignore best-effort
      }
      await safeReply(interaction, { content: `Status ticket/order diupdate ke \`${targetStatus}\`.`, flags: MessageFlags.Ephemeral }).catch(() => null);

      if (targetStatus === "completed") {
        await interaction.channel.send({
          content: "🎉 **Order Selesai!** Terima kasih telah mempercayakan order Anda di HYPEBOTX. Mohon luangkan waktu sejenak untuk memberikan testimoni.",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(componentIds.testimoniButton)
                .setLabel("Berikan Testimoni")
                .setStyle(ButtonStyle.Success)
                .setEmoji("⭐")
            )
          ]
        }).catch(() => null);
      }

      return { ok: true };
    }

    if (actionId === componentIds.quickActionCloseTicket) {
      if (repositories.ticketRepository && interaction?.client?.container?.services?.ticketService?.requestCloseTicket) {
        await interaction.client.container.services.ticketService.requestCloseTicket(interaction, "Closed by quick action");
        return { ok: true };
      }
      await safeReply(interaction, { content: "Fitur close ticket tidak tersedia.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return { ok: false };
    }

    return null;
  }

  async function setJokiShift({
    guildId,
    staffUserId,
    shiftStartAt,
    shiftEndAt,
    note = "",
    setBy = null,
  }) {
    const start = new Date(shiftStartAt).toISOString();
    const end = new Date(shiftEndAt).toISOString();
    return repositories.opsRepository.jokiShifts.create({
      guildId,
      staffUserId,
      shiftStartAt: start,
      shiftEndAt: end,
      note: String(note || "").trim().slice(0, 300),
      setBy,
      status: "planned",
    });
  }

  async function listJokiShifts(guildId, staffUserId = null, limit = 30) {
    const rows = await repositories.opsRepository.jokiShifts.getAll();
    return rows
      .filter((row) => row.guildId === guildId && (!staffUserId || row.staffUserId === staffUserId))
      .sort((a, b) => new Date(a.shiftStartAt).getTime() - new Date(b.shiftStartAt).getTime())
      .slice(-limit);
  }

  async function addJokiCommission({
    guildId,
    staffUserId,
    orderId,
    amount,
    note = "",
    actorId = null,
  }) {
    const safeAmount = parseAmount(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      throw new Error("Nilai komisi tidak valid.");
    }
    return repositories.opsRepository.jokiCommissions.create({
      guildId,
      staffUserId,
      orderId: String(orderId || "").trim() || "-",
      amount: safeAmount,
      note: String(note || "").trim().slice(0, 300),
      actorId,
      paidOut: false,
    });
  }

  async function getJokiCommissionRecap(guildId, { staffUserId = null, month = null } = {}) {
    const rows = await repositories.opsRepository.jokiCommissions.getAll();
    const filtered = rows.filter((row) => {
      if (row.guildId !== guildId) return false;
      if (staffUserId && row.staffUserId !== staffUserId) return false;
      if (month) {
        const key = String(month).trim();
        const created = String(row.createdAt || "");
        if (!created.startsWith(key)) return false;
      }
      return true;
    });

    const totalAmount = filtered.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const groupedByStaff = new Map();
    for (const row of filtered) {
      const key = row.staffUserId || "-";
      groupedByStaff.set(key, (groupedByStaff.get(key) || 0) + Number(row.amount || 0));
    }

    return {
      entries: filtered,
      totalAmount,
      groupedByStaff: [...groupedByStaff.entries()].map(([userId, amount]) => ({ userId, amount })),
    };
  }

  async function syncPaidEmbedsByTicket({
    guild,
    ticket,
    order,
    actorUser,
  }) {
    if (!order || !guild || !ticket) return;
    const channel = guild.channels.cache.get(ticket.channelId) ||
      await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return;
    const detailText = ticket?.meta?.detail || ticket?.meta?.paymentNote || order.detail || "-";
    await orderService?.sendOrderSummary?.(
      channel,
      "ORDER BARU",
      String(detailText),
      0x57f287,
      {
        ticket,
        interaction: { guild, user: actorUser || { id: "system", username: "system", toString: () => "system" } },
        product: order.product,
        order,
        meta: ticket?.meta || {},
      },
      order.id,
      ticket.id,
    ).catch(() => null);

    await orderService?.sendOrEditInvoice?.({
      channel,
      interaction: { guild, user: actorUser || { id: "system", username: "system", toString: () => "system" } },
      order,
      orderId: order.id,
      repositories,
    }).catch(() => null);
  }

  async function addMutationAndMatch({
    guild,
    amount,
    reference,
    method = "qris",
    note = "",
    source = "manual",
    actorId = null,
  }) {
    const safeAmount = parseAmount(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      return { ok: false, message: "Nominal mutasi tidak valid." };
    }

    const safeRef = String(reference || "").trim().slice(0, 120) || `REF-${Date.now()}`;
    const allMutations = await repositories.opsRepository.mutations.getAll();
    if (allMutations.some((m) => m.guildId === guild.id && m.reference === safeRef)) {
      return { ok: false, message: "Duplicate mutation reference." };
    }

    const mutation = await repositories.opsRepository.mutations.create({
      guildId: guild.id,
      amount: safeAmount,
      reference: safeRef,
      method: String(method || "qris"),
      note: String(note || "").trim().slice(0, 500),
      source,
      actorId,
      processed: false,
      matchedPaymentId: null,
      matchedOrderId: null,
    });

    const result = await runMutationAutoMatch(guild, { mutationId: mutation.id, actorId: actorId || "system" });
    return { ok: true, mutation, match: result };
  }

  async function runMutationAutoMatch(guild, { mutationId = null, actorId = "system" } = {}) {
    const allMutations = await repositories.opsRepository.mutations.getAll();
    const targets = allMutations
      .filter((row) => row.guildId === guild.id)
      .filter((row) => (mutationId ? row.id === mutationId : row.processed !== true))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const allPayments = await repositories.paymentRepository.getAll();
    const pendingPayments = allPayments
      .filter((row) => row.guildId === guild.id)
      .filter((row) => !isPaymentTerminal(row.status));

    let matched = 0;
    const details = [];

    for (const mutation of targets) {
      const candidates = [];
      for (const payment of pendingPayments) {
        const order = payment.ticketId
          ? await repositories.orderRepository.findByTicketId(payment.ticketId).catch(() => null)
          : payment.orderId
            ? await repositories.orderRepository.findById(payment.orderId).catch(() => null)
            : null;
        const expectedAmount = parseAmount(payment.amount) || parseAmount(order?.price);
        if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) continue;
        if (expectedAmount !== parseAmount(mutation.amount)) continue;

        candidates.push({ payment, order, expectedAmount });
      }

      if (!candidates.length) {
        details.push({ mutationId: mutation.id, matched: false, reason: "no_amount_match" });
        continue;
      }

      candidates.sort((a, b) => new Date(a.payment.createdAt).getTime() - new Date(b.payment.createdAt).getTime());
      const selected = candidates[0];
      const ticket = selected.payment.ticketId
        ? await repositories.ticketRepository.findById(selected.payment.ticketId).catch(() => null)
        : null;

      await repositories.paymentRepository.updateById(selected.payment.id, {
        status: "paid",
        checkedBy: actorId,
        checkedAt: nowIso(),
        note: `[AUTO MUTASI:${mutation.reference}] ${mutation.note || ""}`.trim(),
      });

      if (ticket) {
        await statusSyncService?.syncTicketOrderQueueStatus?.({
          guildId: guild.id,
          ticketId: ticket.id,
          status: "paid",
          actorId,
          note: `Auto paid by mutation ${mutation.reference}`,
          repositories,
        }).catch((error) => {
          logBestEffort("auto mutation sync status", {
            guildId: guild.id,
            ticketId: ticket.id,
            paymentId: selected.payment.id,
            mutationId: mutation.id,
          }, error);
        });
      }

      const updatedOrder = selected.order
        ? await repositories.orderRepository.updateById(selected.order.id, {
          paymentStatus: "paid",
          status: "paid",
          adminNote: [
            String(selected.order.adminNote || "").trim(),
            `[AUTO MUTASI] matched ref=${mutation.reference} amount=${mutation.amount}`,
          ].filter(Boolean).join("\n"),
        }).catch(() => null)
        : null;

      await repositories.opsRepository.mutations.updateById(mutation.id, {
        processed: true,
        matchedPaymentId: selected.payment.id,
        matchedOrderId: updatedOrder?.id || selected.order?.id || null,
        matchedTicketId: ticket?.id || null,
        processedAt: nowIso(),
      });

      const ticketChannel = ticket?.channelId
        ? guild.channels.cache.get(ticket.channelId) || await guild.channels.fetch(ticket.channelId).catch(() => null)
        : null;
      if (ticketChannel?.isTextBased?.()) {
        await ticketChannel.send(
          `[AUTO PAYMENT] Pembayaran terdeteksi dari ${mutation.method.toUpperCase()} / mutasi (ref: \`${mutation.reference}\`). Status payment ditandai PAID.`,
        ).catch(() => null);
      }

      await syncPaidEmbedsByTicket({
        guild,
        ticket,
        order: updatedOrder || selected.order,
        actorUser: { id: actorId, username: "auto-mutasi", toString: () => "auto-mutasi" },
      });

      await loggingService?.logPayment?.(
        guild,
        "Auto Payment Matched",
        `Mutasi otomatis match payment \`${selected.payment.id}\`.`,
        [
          { name: "Mutation Ref", value: mutation.reference, inline: true },
          { name: "Amount", value: formatCurrency(Number(mutation.amount || 0)), inline: true },
          { name: "Payment ID", value: selected.payment.id, inline: true },
          { name: "Order ID", value: updatedOrder?.id || selected.order?.id || "-", inline: true },
        ],
      ).catch(() => null);

      matched += 1;
      details.push({
        mutationId: mutation.id,
        matched: true,
        paymentId: selected.payment.id,
        orderId: updatedOrder?.id || selected.order?.id || null,
      });

      const idx = pendingPayments.findIndex((row) => row.id === selected.payment.id);
      if (idx >= 0) pendingPayments.splice(idx, 1);
    }

    return { matched, scanned: targets.length, details };
  }

  async function sendTermsPanel(channel) {
    if (!channel?.isTextBased?.()) return null;
    const termsText = [
      "Dengan melanjutkan order, kamu setuju:",
      "1. Data akun sensitif dikirim hanya di ticket resmi.",
      "2. Tidak boleh chargeback sepihak setelah layanan berjalan.",
      "3. Follow SOP support/payment/refund/dispute yang berlaku.",
      "4. Warranty/refund/dispute diproses sesuai kebijakan admin.",
    ].join("\n");

    return channel.send({
      embeds: [
        createEmbed({
          title: "SOP / Terms Acceptance",
          description: termsText,
          color: 0xf1c40f,
        }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(componentIds.termsAcceptButton)
            .setLabel("Saya Setuju SOP / Terms")
            .setStyle(ButtonStyle.Success),
        ),
      ],
    }).catch((error) => {
      logBestEffort("send terms panel", { channelId: channel?.id }, error);
      return null;
    });
  }

  async function acceptTerms(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const rows = await repositories.opsRepository.termsAcceptances.getAll();
    const existing = rows.find((row) => row.guildId === guildId && row.userId === userId);
    const acceptedAt = nowIso();
    if (existing) {
      await repositories.opsRepository.termsAcceptances.updateById(existing.id, {
        acceptedAt,
        channelId: interaction.channel?.id || null,
      });
    } else {
      await repositories.opsRepository.termsAcceptances.create({
        guildId,
        userId,
        username: interaction.user.tag || interaction.user.username,
        acceptedAt,
        channelId: interaction.channel?.id || null,
      });
    }

    const existingUser = await repositories.userRepository?.find?.(guildId, userId).catch(() => null);
    await repositories.userRepository?.upsert?.({
      ...(existingUser || {}),
      guildId,
      userId,
      username: interaction.user.tag || interaction.user.username,
      termsAcceptedAt: acceptedAt,
    }).catch(() => null);

    return acceptedAt;
  }

  async function hasAcceptedTerms(guildId, userId) {
    const rows = await repositories.opsRepository.termsAcceptances.getAll();
    return rows.some((row) => row.guildId === guildId && row.userId === userId);
  }

  async function getTermsStatus(guildId, userId) {
    const rows = await repositories.opsRepository.termsAcceptances.getAll();
    return rows.find((row) => row.guildId === guildId && row.userId === userId) || null;
  }

  function dashboardHtml(snapshot) {
    const cards = [
      ["Guilds", snapshot.guildCount],
      ["Commands", snapshot.commandCount],
      ["Open Tickets", snapshot.runtime.openTickets],
      ["Pending Orders", snapshot.runtime.pendingOrders],
      ["Pending Payments", snapshot.runtime.pendingPayments],
      ["Active Joki", snapshot.runtime.activeJoki],
      ["Uptime (s)", snapshot.uptimeSeconds],
    ];

    const cardHtml = cards
      .map(([label, value]) => `<div class="card"><h3>${label}</h3><p>${value}</p></div>`)
      .join("");
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Owner Dashboard</title>
  <style>
    :root { --bg:#f5f7fb; --text:#1f2937; --card:#ffffff; --accent:#2563eb; --muted:#64748b; }
    * { box-sizing:border-box; font-family: "Segoe UI", Tahoma, sans-serif; }
    body { margin:0; background:linear-gradient(180deg,#eef4ff,#f8fafc); color:var(--text); }
    .wrap { max-width:1000px; margin:0 auto; padding:24px; }
    h1 { margin:0 0 8px; font-size:28px; }
    .muted { color:var(--muted); margin-bottom:20px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
    .card { background:var(--card); border-radius:12px; padding:16px; border:1px solid #dbe6ff; }
    .card h3 { margin:0 0 8px; font-size:14px; color:var(--muted); }
    .card p { margin:0; font-size:22px; font-weight:700; color:var(--accent); }
    pre { background:#0f172a; color:#e2e8f0; padding:12px; border-radius:10px; overflow:auto; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Owner Dashboard</h1>
    <div class="muted">Updated: ${snapshot.now}</div>
    <div class="grid">${cardHtml}</div>
    <h2>Memory</h2>
    <pre>${JSON.stringify(snapshot.memory, null, 2)}</pre>
    <h2>Jobs</h2>
    <pre>${JSON.stringify(snapshot.jobs, null, 2)}</pre>
  </div>
</body>
</html>`;
  }

  async function startOwnerDashboardServer(client) {
    if (dashboardServer) {
      return { url: dashboardUrl };
    }

    const port = Number(process.env.OWNER_DASHBOARD_PORT || 8787);
    const host = process.env.OWNER_DASHBOARD_HOST || "127.0.0.1";
    const secret = process.env.OWNER_DASHBOARD_TOKEN || "";

    dashboardServer = http.createServer(async (req, res) => {
      try {
        const method = req.method || "GET";
        const url = req.url || "/";

        if (method === "GET" && url === "/health.json") {
          const snapshot = await getHealthSnapshot(client);
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(snapshot, null, 2));
          return;
        }

        if (method === "POST" && url === "/mutasi") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString("utf8");
            if (body.length > 1024 * 100) {
              req.destroy();
            }
          });
          req.on("end", async () => {
            try {
              const payload = body ? JSON.parse(body) : {};
              if (secret && payload.secret !== secret) {
                res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ ok: false, message: "Unauthorized" }));
                return;
              }

              const guildId = payload.guildId;
              const guild = client.guilds.cache.get(guildId) ||
                await client.guilds.fetch(guildId).catch(() => null);
              if (!guild) {
                res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ ok: false, message: "Guild not found" }));
                return;
              }

              const result = await addMutationAndMatch({
                guild,
                amount: payload.amount,
                reference: payload.reference,
                method: payload.method || "qris",
                note: payload.note || "",
                source: "webhook",
                actorId: "webhook",
              });

              res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify(result, null, 2));
            } catch (error) {
              res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ ok: false, message: error.message }));
            }
          });
          return;
        }

        if (method === "GET" && (url === "/" || url.startsWith("/?"))) {
          const snapshot = await getHealthSnapshot(client);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(dashboardHtml(snapshot));
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
      } catch (error) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Internal error: ${error.message}`);
      }
    });

    await new Promise((resolve, reject) => {
      dashboardServer.once("error", reject);
      dashboardServer.listen(port, host, () => resolve());
    }).catch((error) => {
      dashboardServer = null;
      throw error;
    });

    dashboardUrl = `http://${host}:${port}`;
    logger?.info?.("owner dashboard server started", { dashboardUrl });
    return { url: dashboardUrl };
  }

  async function stopOwnerDashboardServer() {
    if (!dashboardServer) return;
    await new Promise((resolve) => {
      dashboardServer.close(() => resolve());
    });
    dashboardServer = null;
    dashboardUrl = null;
  }

  return {
    getHealthSnapshot,
    createCoupon,
    listCoupons,
    redeemCoupon,
    submitTestimonial,
    listTestimonials,
    buildExportPayload,
    handleSensitiveDataWarning,
    getAdminGuideLines,
    postQuickActionPanel,
    handleQuickActionButton,
    setJokiShift,
    listJokiShifts,
    addJokiCommission,
    getJokiCommissionRecap,
    addMutationAndMatch,
    runMutationAutoMatch,
    sendTermsPanel,
    acceptTerms,
    hasAcceptedTerms,
    getTermsStatus,
    startOwnerDashboardServer,
    stopOwnerDashboardServer,
    getDashboardUrl: () => dashboardUrl,
  };
}

module.exports = {
  createBacklogService,
};
