const fs = require("fs");
const path = require("path");
const { createEmbed } = require("../utils/embed");
const { MessageFlags } = require("discord.js");

function normalizeStatus(status) {
  const map = {
    pending: "pending",
    queued: "queued",
    process: "processing",
    proses: "processing",
    processing: "processing",
    done: "completed",
    selesai: "completed",
    completed: "completed",
    cancel: "cancelled",
    cancelled: "cancelled",
    refund: "refunded",
    refunded: "refunded",
    hold: "waiting",
    waiting: "waiting",
    "waiting-payment": "waiting",
    paid: "paid",
    lunas: "paid",
  };
  return map[String(status || "").toLowerCase()] || String(status || "").toLowerCase();
}

function renderOrder(order) {
  if (!order) return "Order tidak ditemukan.";
  return [
    `Order ID: ${order.id}`,
    `Customer: <@${order.userId}>`,
    `Produk: ${order.product || "-"}`,
    `Kategori: ${order.category || "-"}`,
    `Status Order: ${order.status || "-"}`,
    `Status Payment: ${order.paymentStatus || "-"}`,
    `Ticket: ${order.ticketId ? `#${order.ticketId}` : "-"}`,
    `Staff: ${order.staffHandle ? `<@${order.staffHandle}>` : "-"}`,
    `Tanggal: ${order.createdAt || "-"}`,
  ].join("\n");
}

function shouldAutoQueueJoki(ticket) {
  const formType = String(ticket?.meta?.formType || "").toLowerCase();
  return ["joki", "gta"].includes(formType);
}

function createStoreOpsService({
  botConfig,
  logger,
  repositories,
  loggingService,
  orderService,
  ticketService,
  paymentService,
  jokiService,
  statusSyncService,
}) {
  const simple = repositories.simpleStoreRepository;
  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
  }

  function resolveQueuePublishAction(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "completed") return "auto-complete";
    if (normalized === "processing") return "auto-start";
    if (normalized === "queued") return "manual-add";
    return "queue-update";
  }

  async function publishQueueListFromSync(guild, syncResult, status) {
    const queueOrderId = String(syncResult?.queueOrderId || "").trim();
    if (!queueOrderId) return null;
    if (!repositories?.jokiRepository?.getOrderById) return null;
    if (!jokiService?.publishQueueUpdate) return null;

    const queueOrder = await repositories.jokiRepository.getOrderById(guild.id, queueOrderId).catch((error) => {
      logBestEffort("fetch queue order for publish", {
        guildId: guild.id,
        queueOrderId,
      }, error);
      return null;
    });
    if (!queueOrder) return null;

    return jokiService.publishQueueUpdate(guild, queueOrder, resolveQueuePublishAction(status)).catch((error) => {
      logBestEffort("publish queue-list from store ops", {
        guildId: guild.id,
        queueOrderId,
        status,
      }, error);
      return null;
    });
  }

  async function writeStaffLog(interaction, action, target = "-", detail = "-") {
    const row = await simple.staffLogs.create({
      guildId: interaction.guild.id,
      action,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      target,
      detail,
    });

    await loggingService.logBot(interaction.guild, "Staff Action", detail, [
      { name: "Action", value: action, inline: true },
      { name: "Actor", value: interaction.user.tag, inline: true },
      { name: "Target", value: String(target), inline: true },
    ]).catch((error) => {
      logBestEffort("log staff action", {
        guildId: interaction.guild.id,
        action,
        target,
      }, error);
    });

    return row;
  }

  async function openOrderTicket(interaction, detail = "Order dari /order") {
    return ticketService.createTicketChannel(interaction.guild, interaction.member, "order", { detail });
  }

  async function getMyStatus(interaction) {
    const orders = await repositories.orderRepository.findByUserId(interaction.guild.id, interaction.user.id);
    if (!orders.length) return "Kamu belum punya order tercatat.";
    return orders
      .slice(-5)
      .reverse()
      .map(renderOrder)
      .join("\n\n");
  }

  async function getOrderList(guildId, limit = 10) {
    const orders = await repositories.orderRepository.getAll();
    return orders
      .filter((order) => order.guildId === guildId)
      .slice(-limit)
      .reverse();
  }

  async function updateOrder(interaction, orderId, status, note = "") {
    const normalized = normalizeStatus(status);
    const existing = await repositories.orderRepository.findById(orderId);
    if (!existing) return null;

    await repositories.orderRepository.updateById(orderId, {
      adminNote: note,
      staffHandle: interaction.user.id,
    });

    if (existing.ticketId && statusSyncService?.syncTicketOrderQueueStatus) {
      const sync = await statusSyncService.syncTicketOrderQueueStatus({
        guildId: interaction.guild.id,
        ticketId: existing.ticketId,
        status: normalized,
        actorId: interaction.user.id,
        note: `Manual order update: ${note || "-"}`,
        repositories,
      }).catch((error) => {
        logger?.error?.("manual order status sync failed", {
          guildId: interaction.guild.id,
          orderId,
          ticketId: existing.ticketId,
          status: normalized,
          message: error.message,
        });
        return null;
      });

      if (sync && !sync.ok) {
        logger?.warn?.("manual order status sync partial failure", {
          guildId: interaction.guild.id,
          orderId,
          ticketId: existing.ticketId,
          status: normalized,
          errors: sync.errors,
        });
      }

      await publishQueueListFromSync(interaction.guild, sync, normalized);
    } else {
      await repositories.orderRepository.updateById(orderId, { status: normalized });
      if (existing.ticketId) {
        await repositories.ticketRepository.update(existing.ticketId, { orderStatus: normalized }).catch((error) => {
          logBestEffort("fallback ticket status update", {
            guildId: interaction.guild.id,
            orderId,
            ticketId: existing.ticketId,
            status: normalized,
          }, error);
        });
      }
    }

    const order = await repositories.orderRepository.findById(orderId);
    await writeStaffLog(interaction, "update_order", orderId, `Update ${orderId} ke ${normalized}. ${note || ""}`.trim());
    await loggingService.logOrder(interaction.guild, "Order Updated", renderOrder(order), [
      { name: "Staff", value: interaction.user.tag, inline: true },
      { name: "Note", value: note || "-", inline: false },
    ]).catch((error) => {
      logBestEffort("log order updated", {
        guildId: interaction.guild.id,
        orderId,
      }, error);
    });
    return order;
  }

  async function addManualOrder(interaction, user, product, price = "", detail = "") {
    const ticketId = `MANUAL-${Date.now()}`;
    const newOrderId = await simple.getNextOrderId(interaction.guild.id);
    const order = await repositories.orderRepository.create({
      id: newOrderId,
      guildId: interaction.guild.id,
      ticketId,
      userId: user.id,
      customerName: user.tag || user.username,
      category: "manual",
      product,
      price,
      detail,
      status: "pending",
      paymentStatus: "unpaid",
      staffHandle: interaction.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repositories.userRepository.incrementOrder(interaction.guild.id, user.id, user.tag || user.username);
    await writeStaffLog(interaction, "add_order", order.id, renderOrder(order));
    await loggingService.logOrder(interaction.guild, "Manual Order Created", renderOrder(order)).catch((error) => {
      logBestEffort("log manual order created", {
        guildId: interaction.guild.id,
        orderId: order.id,
      }, error);
    });
    return order;
  }

  async function paymentCheck(interaction, paymentId, status = "paid", note = "") {
    const normalized = normalizeStatus(status) === "paid" ? "paid" : normalizeStatus(status);
    const payment = await repositories.paymentRepository.updateById(paymentId, {
      status: normalized,
      checkedBy: interaction.user.id,
      checkedAt: new Date().toISOString(),
      note: note || undefined,
    });
    if (!payment) return null;

    if (payment.ticketId) {
      const syncStatus = normalized === "submitted" ? "waiting" : normalized;
      if (statusSyncService?.syncTicketOrderQueueStatus) {
        await statusSyncService.syncTicketOrderQueueStatus({
          guildId: interaction.guild.id,
          ticketId: payment.ticketId,
          status: syncStatus,
          actorId: interaction.user.id,
          note: `Payment check: ${normalized}`,
          repositories,
        }).catch((error) => {
          logger?.error?.("payment status sync failed", {
            paymentId,
            ticketId: payment.ticketId,
            status: syncStatus,
            message: error.message,
          });
        });
      } else {
        await repositories.ticketRepository.update(payment.ticketId, { orderStatus: syncStatus }).catch((error) => {
          logBestEffort("fallback ticket status update from payment", {
            guildId: interaction.guild.id,
            paymentId,
            ticketId: payment.ticketId,
            status: syncStatus,
          }, error);
        });
      }

      const orderChanges = { paymentStatus: normalized };
      if (normalized === "paid" || normalized === "waiting") {
        orderChanges.status = normalized;
      }
      await repositories.orderRepository.updateByTicketId(payment.ticketId, orderChanges).catch((error) => {
        logBestEffort("update order after payment check", {
          guildId: interaction.guild.id,
          paymentId,
          ticketId: payment.ticketId,
        }, error);
      });

      const ticket = await repositories.ticketRepository.findById?.(payment.ticketId).catch((error) => {
        logBestEffort("find ticket after payment check", {
          guildId: interaction.guild.id,
          paymentId,
          ticketId: payment.ticketId,
        }, error);
        return null;
      });
      if (normalized === "paid" && shouldAutoQueueJoki(ticket) && jokiService?.startQueue) {
        const result = await jokiService.startQueue({
          guild: interaction.guild,
          user: {
            id: payment.userId,
            tag: payment.userId,
          },
        }, {
          ticketId: payment.ticketId,
          publishAction: "payment-accepted",
        }).catch((error) => {
          logger?.error?.("auto joki queue after payment failed", {
            paymentId,
            ticketId: payment.ticketId,
            message: error.message,
          });
          return null;
        });

        const ticketChannel = ticket?.channelId
          ? interaction.guild.channels.cache.get(ticket.channelId) ||
          await interaction.guild.channels.fetch(ticket.channelId).catch((error) => {
            logBestEffort("fetch ticket channel after payment", {
              guildId: interaction.guild.id,
              ticketId: payment.ticketId,
              channelId: ticket?.channelId,
            }, error);
            return null;
          })
          : null;
        if (result?.entry && ticketChannel?.isTextBased?.()) {
          await ticketChannel.send(
            `[AUTO] Payment diterima. Ticket otomatis masuk antrian joki (Order ID: \`${result.entry.id}\`).`,
          ).catch((error) => {
            logBestEffort("send auto queue notice after payment", {
              guildId: interaction.guild.id,
              ticketId: payment.ticketId,
              channelId: ticketChannel.id,
            }, error);
          });
        }
      }

      if (normalized === "paid" && orderService?.sendOrderSummary && orderService?.sendOrEditInvoice) {
        const latestOrder = await repositories.orderRepository.findByTicketId(payment.ticketId).catch((error) => {
          logBestEffort("find latest order for paid hook", {
            guildId: interaction.guild.id,
            ticketId: payment.ticketId,
          }, error);
          return null;
        });

        const ticketChannel = ticket?.channelId
          ? interaction.guild.channels.cache.get(ticket.channelId) ||
          await interaction.guild.channels.fetch(ticket.channelId).catch((error) => {
            logBestEffort("fetch ticket channel for paid hook", {
              guildId: interaction.guild.id,
              ticketId: payment.ticketId,
              channelId: ticket?.channelId,
            }, error);
            return null;
          })
          : interaction.channel;

        if (latestOrder && ticketChannel?.isTextBased?.()) {
          const relatedTicketMeta = ticket?.meta || {};
          const detailText =
            relatedTicketMeta?.detail ||
            relatedTicketMeta?.paymentNote ||
            relatedTicketMeta?.budgetPayment ||
            latestOrder.detail ||
            "-";

          await orderService.sendOrderSummary(
            ticketChannel,
            "ORDER BARU",
            String(detailText),
            0x57f287,
            {
              ticket,
              interaction,
              product: latestOrder.product,
              order: latestOrder,
              meta: relatedTicketMeta,
            },
            latestOrder.id,
            ticket?.id || payment.ticketId,
          ).catch((error) => {
            logBestEffort("send order summary after payment paid", {
              guildId: interaction.guild.id,
              orderId: latestOrder.id,
              ticketId: payment.ticketId,
            }, error);
          });

          await orderService.sendOrEditInvoice({
            channel: ticketChannel,
            interaction,
            order: latestOrder,
            orderId: latestOrder.id,
            repositories,
          }).catch((error) => {
            logBestEffort("send invoice after payment paid", {
              guildId: interaction.guild.id,
              orderId: latestOrder.id,
              ticketId: payment.ticketId,
            }, error);
          });
        }
      }
    }

    await writeStaffLog(interaction, "payment_check", paymentId, `Payment ${paymentId} => ${normalized}. ${note || ""}`);
    await loggingService.logPayment(interaction.guild, "Payment Checked", `Payment \`${paymentId}\` diubah ke \`${normalized}\`.`, [
      { name: "Staff", value: interaction.user.tag, inline: true },
      { name: "Note", value: note || "-", inline: false },
    ]).catch((error) => {
      logBestEffort("log payment checked", {
        guildId: interaction.guild.id,
        paymentId,
      }, error);
    });
    return payment;
  }

  async function addQueue(interaction, user, ticketId, estimatedMinutes = 20) {
    const result = await jokiService.startQueue({
      guild: interaction.guild,
      user,
    }, {
      ticketId,
      estimatedSeconds: estimatedMinutes * 60,
    });
    await writeStaffLog(interaction, "add_queue", ticketId || result.entry.id, `Tambah antrian joki untuk ${user.tag || user.id}`);
    return result;
  }

  async function updateQueue(interaction, queueId, status) {
    const normalized = normalizeStatus(status);
    const updatedQueue = await repositories.jokiRepository.setOrderStatus(interaction.guild.id, queueId, {
      status: normalized,
    });
    if (updatedQueue) {
      const updatedOrder = updatedQueue?.orders?.find((order) => order.id === queueId) ||
        await repositories.jokiRepository.getOrderById(interaction.guild.id, queueId).catch((error) => {
          logBestEffort("find queue order after manual update", {
            guildId: interaction.guild.id,
            queueId,
          }, error);
          return null;
        });
      const syncResult = await statusSyncService?.syncTicketOrderQueueStatus({
        guildId: interaction.guild.id,
        ticketId: updatedOrder?.ticketId || null,
        queueId,
        status: normalized,
        actorId: interaction.user.id,
        note: `Manual queue update to ${normalized}`,
        repositories,
      }).catch((error) => {
        logger?.error?.("manual queue status sync failed", {
          guildId: interaction.guild.id,
          queueId,
          status: normalized,
          message: error.message,
        });
        return null;
      });
      if (syncResult && !syncResult.ok) {
        logger?.warn?.("manual queue status sync partial failure", {
          guildId: interaction.guild.id,
          queueId,
          status: normalized,
          errors: syncResult.errors,
        });
      }
      await publishQueueListFromSync(interaction.guild, syncResult, normalized);
      await writeStaffLog(interaction, "update_queue", queueId, `Queue ${queueId} => ${status}`);
      return updatedOrder || { id: queueId, status: normalized };
    }
    return null;
  }

  async function addNote(interaction, orderId, note) {
    const row = await simple.adminNotes.create({
      guildId: interaction.guild.id,
      orderId,
      note,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
    });
    await repositories.orderRepository.updateById(orderId, { adminNote: note, staffHandle: interaction.user.id }).catch((error) => {
      logBestEffort("update order note", {
        guildId: interaction.guild.id,
        orderId,
      }, error);
    });
    await writeStaffLog(interaction, "note", orderId, note);
    return row;
  }

  async function setBlacklist(interaction, user, reason) {
    const row = await simple.blacklist.create({
      guildId: interaction.guild.id,
      userId: user.id,
      username: user.tag || user.username,
      reason,
      actorId: interaction.user.id,
    });
    const existing = await repositories.userRepository.find(interaction.guild.id, user.id);
    await repositories.userRepository.upsert({
      ...(existing || {}),
      guildId: interaction.guild.id,
      userId: user.id,
      username: user.tag || user.username,
      status: "blacklist",
      blacklistReason: reason,
    });
    await writeStaffLog(interaction, "blacklist", user.id, reason);
    return row;
  }

  async function upsertFaq(interaction, keyword, answer, category = "general") {
    const all = await simple.faqs.getAll();
    const existing = all.find((faq) => faq.guildId === interaction.guild.id && faq.keyword.toLowerCase() === keyword.toLowerCase());
    const payload = {
      guildId: interaction.guild.id,
      keyword,
      answer,
      category,
      actorId: interaction.user.id,
    };
    const row = existing
      ? await simple.faqs.updateById(existing.id, payload)
      : await simple.faqs.create(payload);
    await writeStaffLog(interaction, "faq_upsert", keyword, answer.slice(0, 250));
    return row;
  }

  async function findFaq(guildId, keyword) {
    const all = await simple.faqs.getAll();
    const needle = String(keyword || "").toLowerCase();
    return all.find((faq) => faq.guildId === guildId && (
      faq.keyword.toLowerCase() === needle ||
      faq.keyword.toLowerCase().includes(needle) ||
      needle.includes(faq.keyword.toLowerCase())
    )) || null;
  }

  async function setPrice(interaction, {
    name,
    price,
    description = "",
    category = "",
    sku = null,
    isActive = true,
    sortOrder = 0,
  }) {
    const all = await simple.priceList.getAll();
    const existing = all.find(
      (item) =>
        item.guildId === interaction.guild.id &&
        String(item.name || "").toLowerCase() === String(name || "").toLowerCase(),
    );

    const payload = {
      guildId: interaction.guild.id,
      name,
      price,
      description,
      category: category || "",
      sku: sku || null,
      isActive: isActive !== false,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      actorId: interaction.user.id,
    };

    const row = existing
      ? await simple.priceList.updateById(existing.id, payload)
      : await simple.priceList.create(payload);

    await writeStaffLog(interaction, "set_price", name, `${name}: ${price}`);
    return row;
  }

  async function getPriceList(guildId) {
    const rows = await simple.priceList.getAll();
    const gid = guildId != null ? String(guildId) : "";
    return rows
      .filter((row) => String(row.guildId) === gid && (row.isActive !== false))
      .sort(
        (a, b) =>
          (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) ||
          String(a.name || "").localeCompare(String(b.name || "")),
      );
  }

  async function getPriceListSummary(guildId) {
    const list = await getPriceList(guildId);
    return list.map((item) => ({
      id: item.id || item.sku || item.name || null,
      name: item.name || "",
      category: item.category || "",
      priceFrom: item.price || item.priceFrom || null,
      status: item.status || (item.isActive === false ? "inactive" : "active"),
      description: item.description || "",
    }));
  }

  async function getAllFaqs(guildId) {
    const rows = await simple.faqs.getAll();
    return Array.isArray(rows)
      ? rows.filter((faq) => String(faq.guildId) === String(guildId))
      : [];
  }

  async function getFaqSummary(guildId) {
    const faqs = await getAllFaqs(guildId);
    return faqs.map((faq) => ({
      keyword: faq.keyword || faq.question || "",
      question: faq.question || faq.keyword || "",
      answer: faq.answer || "",
    }));
  }

  async function getOrderGuideSummary(/* guildId */) {
    const filePath = path.join(__dirname, "..", "..", "data", "order-guide.json");
    if (!fs.existsSync(filePath)) {
      return {
        steps: [
          "Pilih produk atau paket joki.",
          "Tanyakan stok ke admin.",
          "Kirim data yang diminta.",
          "Admin membuat invoice.",
          "Customer melakukan payment.",
          "Order diproses sesuai antrian.",
        ],
        warnings: [
          "Jangan kirim password di channel publik.",
          "Pastikan payment sesuai invoice.",
          "Untuk data sensitif, gunakan ticket/private channel.",
        ],
      };
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {
        steps: [
          "Pilih produk atau paket joki.",
          "Tanyakan stok ke admin.",
          "Kirim data yang diminta.",
          "Admin membuat invoice.",
          "Customer melakukan payment.",
          "Order diproses sesuai antrian.",
        ],
        warnings: [
          "Jangan kirim password di channel publik.",
          "Pastikan payment sesuai invoice.",
          "Untuk data sensitif, gunakan ticket/private channel.",
        ],
      };
    }
  }

  async function setPayment(interaction, key, value) {
    const trimmed = String(value || "").trim();
    const expected = {
      bank: ["bca", "bri", "bank"],
      ewallet: ["dana", "shopeepay", "gopay", "ovo", "ewallet", "e-wallet"],
      qris: ["qris", "-"],
    };
    const isValid = expected[key]?.some((keyword) => trimmed.toLowerCase().includes(keyword));
    if (!trimmed || /^\d{1,3}$/.test(trimmed) || !isValid) {
      throw new Error("Format payment tidak valid. Contoh bank: BCA - 5358047992 a.n. NAMA | BRI - 040801040543505 a.n. NAMA");
    }

    const row = await simple.updateSettings({
      [`payment_${key}`]: trimmed,
      guildId: interaction.guild.id,
      actorId: interaction.user.id,
    });
    await writeStaffLog(interaction, "set_payment", key, trimmed.slice(0, 250));
    return row;
  }

  async function getSalesReport(guildId) {
    const orders = (await repositories.orderRepository.getAll()).filter((order) => order.guildId === guildId);
    const total = orders.length;
    const completed = orders.filter((order) => ["completed", "done"].includes(order.status)).length;
    const paid = orders.filter((order) => ["paid", "completed"].includes(order.status) || order.paymentStatus === "paid").length;
    return { total, completed, paid, pending: total - completed };
  }

  async function sendHelp(interaction) {
    const embed = createEmbed({
      title: `${botConfig.storeName} Help`,
      description: [
        "`/order` buka ticket order",
        "`/status` cek status order kamu",
        "`/price` lihat price list",
        "`/faq` cari jawaban umum",
        "`/ticket` buka ticket bantuan",
      ].join("\n"),
    });
    const { safeReply } = require("../utils/discordResponse");
    await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  logger.info("store ops service ready");

  return {
    openOrderTicket,
    getMyStatus,
    getOrderList,
    updateOrder,
    addManualOrder,
    paymentCheck,
    addQueue,
    updateQueue,
    addNote,
    setBlacklist,
    upsertFaq,
    findFaq,
    setPrice,
    getPriceList,
    getPriceListSummary,
    getFaqSummary,
    getOrderGuideSummary,
    setPayment,
    getSalesReport,
    sendHelp,
    writeStaffLog,
    renderOrder,
  };
}

module.exports = {
  createStoreOpsService,
};
