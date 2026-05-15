const { createOrder } = require("../database/models/Order");
const roles = require("../config/roles");
const { createEmbed } = require("../utils/embed");
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { componentIds } = require("../utils/constants");

function getModalValue(fields, ...candidateIds) {
  for (const fieldId of candidateIds) {
    if (!fieldId) continue;
    try {
      const raw = fields.getTextInputValue(fieldId);
      if (typeof raw === "string") {
        const value = raw.trim();
        if (value) return value;
      }
    } catch {
      // Ignore missing field IDs to keep backward compatibility.
    }
  }
  return "";
}

function extractProductFromText(raw, fallback = "Order") {
  if (!raw) return fallback;
  const firstChunk = raw.split(/\r?\n|\|/)[0] || "";
  const normalized = firstChunk
    .replace(/^game\s*:\s*/i, "")
    .replace(/^service\s*:\s*/i, "")
    .replace(/^item\s*:\s*/i, "")
    .replace(/^paket\s*\/\s*nominal\s*top\s*up\s*:\s*/i, "")
    .trim();
  return normalized || fallback;
}

function clampEmbedDescription(text, limit = 4096) {
  if (!text || typeof text !== "string") {
    return "-";
  }

  if (text.length <= limit) {
    return text;
  }

  const marker = "\n\n[Dipotong karena terlalu panjang]";
  return `${text.slice(0, Math.max(0, limit - marker.length))}${marker}`;
}

function firstMatch(text, patterns, fallback = "-") {
  const raw = String(text || "");
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return fallback;
}

function parseKeyValueText(...chunks) {
  const result = {};
  const text = chunks
    .filter(Boolean)
    .map((chunk) => String(chunk))
    .join("\n");

  for (const part of text.split(/\r?\n|\|/)) {
    const match = part.match(/^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/);
    if (!match) continue;

    const key = match[1]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const value = match[2].trim();
    if (key && value) {
      result[key] = value;
    }
  }

  return result;
}

function pickParsed(parsed, keys, fallback = "-") {
  for (const key of keys) {
    if (parsed[key]) return parsed[key];
  }
  return fallback;
}

function detectPlatform(text) {
  const raw = String(text || "").toLowerCase();
  if (raw.includes("steam")) return "steam";
  if (raw.includes("epic")) return "epic";
  if (raw.includes("rockstar")) return "rockstar";
  if (raw.includes("ps5") || raw.includes("playstation")) return "playstation";
  if (raw.includes("xbox")) return "xbox";
  return "-";
}

function detectVersion(text, member) {
  const raw = String(text || "").toLowerCase();
  if (raw.includes("enhanced")) return "enhanced";
  if (raw.includes("legacy")) return "legacy";

  const roleNames = [...(member?.roles?.cache?.values?.() || [])]
    .map((role) => String(role.name || "").toLowerCase());
  if (roleNames.includes("enhanced")) return "enhanced";
  if (roleNames.includes("legacy")) return "legacy";
  return "-";
}

function buildOrderSummaryEmbed({ ticket, interaction, product, detail, meta, color, orderId, order }) {
  const formType = String(meta?.formType || ticket?.meta?.formType || "").toLowerCase();
  if (!["joki", "gta"].includes(formType)) {
    return null;
  }

  const gameText = meta?.gameInfo || meta?.gtaDetails || detail || "";
  const paymentText = meta?.paymentNote || meta?.budgetPayment || "";
  const parsed = parseKeyValueText(gameText, paymentText, meta?.targetDeadline);
  const item = firstMatch(gameText, [
    /item\s*[:=]\s*([^\n|]+)/i,
    /paket\s*(?:joki)?\s*[:=]\s*([^\n|]+)/i,
    /(?:money|uang)\s*[:=]\s*([^\n|]+)/i,
  ], pickParsed(parsed, ["item", "paket", "paket_joki", "money", "uang"], product || gameText || "-"));
  const price = firstMatch(paymentText, [
    /(?:harga|price|total|jumlah bayar)\s*[:=]\s*([^\n|]+)/i,
    /(rp\.?\s*[0-9][0-9.,]*)/i,
    /([0-9][0-9.,]*\s*(?:k|rb|ribu|jt|juta))/i,
  ], pickParsed(parsed, ["harga", "price", "total", "total_bayar", "jumlah_bayar"]));
  const method = firstMatch(paymentText, [
    /(?:metode|method)\s*[:=]\s*([^\n|]+)/i,
    /\b(bca|bri|dana|shopeepay|qris|gopay|ovo)\b/i,
  ], pickParsed(parsed, ["metode", "method", "metode_pembayaran", "login_via", "login"]));
  const rockstarId = firstMatch(gameText, [
    /rockstar(?:\s*id)?\s*[:=]\s*([^\n|]+)/i,
    /rid\s*[:=]\s*([^\n|]+)/i,
  ], pickParsed(parsed, ["rockstar_id", "rockstar", "rid"], meta?.customerName || "-"));
  const notes = pickParsed(parsed, ["notes", "note", "catatan", "request", "target", "deadline"], meta?.targetDeadline || meta?.budgetPayment || meta?.paymentNote || "-");
  const platform = pickParsed(parsed, ["platform"], detectPlatform(gameText));
  const version = pickParsed(parsed, ["versi", "version"], detectVersion(gameText, interaction.member));
  const paymentStatus = order?.paymentStatus || "-";
  const orderStatus = order?.status || "-";

  return createEmbed({
    title: "ORDER BARU",
    color,
    fields: [
      { name: "Order ID", value: orderId || `ORD-${ticket.id}`, inline: true },
      { name: "Nama", value: meta?.customerName || interaction.user.username || "-", inline: true },
      { name: "Service", value: product || "Joki Service", inline: true },
      { name: "Platform", value: platform || "-", inline: true },
      { name: "Versi", value: version || "-", inline: false },
      { name: "Rockstar ID", value: rockstarId || "-", inline: false },
      { name: "Item", value: item || "-", inline: false },
      { name: "Harga", value: price || "-", inline: true },
      { name: "Metode", value: method || "-", inline: true },
      { name: "Payment Status", value: paymentStatus, inline: true },
      { name: "Order Status", value: orderStatus, inline: true },
      { name: "Notes", value: notes || "-", inline: false },
    ],
    footer: interaction.guild?.name || "HYPERINDO",
  });
}

function buildInvoiceEmbed({ order, interaction }) {
  return createEmbed({
    title: `Invoice — ${order.id}`,
    color: 0xf1c40f,
    fields: [
      { name: "Nomor Invoice / Order ID", value: order.id, inline: false },
      { name: "Customer", value: `<@${order.userId}>`, inline: true },
      { name: "Customer Name", value: order.customerName || "-", inline: true },
      { name: "Layanan/Kategori", value: order.category || "-", inline: true },
      { name: "Produk", value: order.product || "-", inline: true },
      { name: "SKU", value: order.sku || "-", inline: true },
      { name: "Total/Price", value: order.price || "-", inline: true },
      { name: "Payment Status", value: order.paymentStatus || "-", inline: true },
      { name: "Order Status", value: order.status || "-", inline: true },
      { name: "Admin Handle", value: order.staffHandle ? `<@${order.staffHandle}>` : "-", inline: true },
      { name: "Admin Note", value: order.adminNote || "-", inline: false },
    ],
    footer: interaction.guild.name,
  });
}

async function sendOrEditInvoice({ channel, interaction, order, orderId, repositories }) {
  if (!channel?.isTextBased?.()) return;

  const invoiceEmbed = buildInvoiceEmbed({ order, interaction });

  const existingInvoiceMessageId = order?.invoiceMessageId || null;
  if (existingInvoiceMessageId) {
    const existingMessage = await channel.messages.fetch(existingInvoiceMessageId).catch(() => null);
    if (existingMessage?.editable) {
      await existingMessage.edit({ embeds: [invoiceEmbed] }).catch(() => null);
      return;
    }
  }

  const sent = await channel.send({
    content: interaction?.user ? `${interaction.user}` : undefined,
    embeds: [invoiceEmbed],
  }).catch(() => null);

  if (sent?.id && orderId && repositories?.orderRepository?.updateById) {
    await repositories.orderRepository.updateById(orderId, { invoiceMessageId: sent.id }).catch(() => null);
  }
}

function buildJokiOrderFormatText({
  customerName,
  discordTag,
  whatsapp,
  gameInfo,
  targetDeadline,
  paymentNote,
}) {
  return [
    `NAMA: ${customerName || "-"}`,
    `USERNAME DISCORD: ${discordTag || "-"}`,
    `NOMOR WHATSAPP: ${whatsapp || "-"}`,
    `GAME / PLATFORM / LOGIN VIA / PAKET JOKI: ${gameInfo || "-"}`,
    `TARGET / REQUEST & DEADLINE: ${targetDeadline || "-"}`,
    `METODE PEMBAYARAN & CATATAN TAMBAHAN: ${paymentNote || "-"}`,
    "",
    "NOTE:",
    "DATA LOGIN AKUN JANGAN DIKIRIM DI CHANNEL PUBLIK.",
    "DATA LOGIN HANYA DIKIRIM MELALUI TICKET / CHAT ADMIN RESMI HYPERINDO.",
  ].join("\n");
}

function buildTopupOrderFormatText({
  customerName,
  discordTag,
  whatsapp,
  topupIdentity,
  topupPackage,
  topupPayment,
}) {
  return [
    "DATA CUSTOMER",
    `NAMA: ${customerName || "-"}`,
    `USERNAME DISCORD: ${discordTag || "-"}`,
    `NOMOR WHATSAPP: ${whatsapp || "-"}`,
    "",
    "DETAIL TOP UP",
    `GAME / NICKNAME / USER ID / SERVER ID: ${topupIdentity || "-"}`,
    `PAKET / NOMINAL / JUMLAH ORDER / CATATAN: ${topupPackage || "-"}`,
    "",
    "PAYMENT",
    `METODE PEMBAYARAN / TOTAL / BUKTI TRANSFER: ${topupPayment || "-"}`,
    "",
    "STATUS ORDER:",
    "MENUNGGU PAYMENT / PROSES / SELESAI",
  ].join("\n");
}

function buildGenericOrderFormatText({
  sections,
  customerName,
  discordTag,
  whatsapp,
  paymentInfo,
  note,
  statusLabel = "STATUS ORDER:",
  statusValue = "MENUNGGU PAYMENT / PROSES / SELESAI",
}) {
  const lines = [
    "DATA CUSTOMER",
    `NAMA: ${customerName || "-"}`,
    `USERNAME DISCORD: ${discordTag || "-"}`,
    `NOMOR WHATSAPP: ${whatsapp || "-"}`,
  ];

  for (const section of sections) {
    lines.push("", section.title);
    for (const [label, value] of section.fields) {
      lines.push(`${label}: ${value || "-"}`);
    }
  }

  if (paymentInfo !== undefined) {
    lines.push("", "PAYMENT", `METODE PEMBAYARAN / TOTAL / CATATAN: ${paymentInfo || "-"}`);
  }

  lines.push("", statusLabel, statusValue);

  if (note) {
    lines.push("", "NOTE:", note);
  }

  return lines.join("\n");
}

function createOrderService({
  botConfig,
  logger,
  repositories,
  ticketService,
  roleService,
  loggingService,
  getJokiService,
  statusSyncService,
}) {
  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
  }

  function shouldAutoQueueJoki(ticket) {
    const formType = String(ticket?.meta?.formType || "").toLowerCase();
    return ["joki", "gta"].includes(formType);
  }

  async function openOrder(interaction, detail = "Order dari slash command") {
    const { ticket, channel, reused } = await ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      "order",
      { detail },
    );

    const existingOrder = await repositories.orderRepository.findByTicketId(ticket.id);
    if (!existingOrder) {
      const newOrderId = await repositories.simpleStoreRepository.getNextOrderId(interaction.guild.id);
      await repositories.orderRepository.create(
        createOrder({
          id: newOrderId,
          guildId: interaction.guild.id,
          ticketId: ticket.id,
          userId: interaction.user.id,
          product: "Manual order",
          detail,
        }),
      );

      loggingService?.logOrder?.(
        interaction.guild,
        "Order Created",
        `Order \`${newOrderId}\` dibuat dari ticket #${ticket.id}.`,
        [
          { name: "Customer", value: interaction.user.tag, inline: true },
          { name: "Ticket", value: ticket.id, inline: true },
        ],
      ).catch(() => null);
    } else {
      const actorId = String(interaction.user?.id || "");
      const orderOwnerId = String(existingOrder?.userId || "");
      const ticketOwnerId = String(ticket?.openerId || "");
      const ownershipMismatch =
        (orderOwnerId && orderOwnerId !== actorId) ||
        (ticketOwnerId && ticketOwnerId !== actorId);

      // Re-open/reuse order is normal for customer flow.
      // Escalate to security log only when ownership mismatch looks suspicious.
      if (ownershipMismatch) {
        loggingService?.logSecurity?.(
          interaction.guild,
          "Order Reuse Ownership Mismatch",
          `Order reuse for ticket #${ticket.id} has ownership mismatch.`,
          [
            { name: "Actor", value: interaction.user.tag, inline: true },
            { name: "Actor ID", value: interaction.user.id, inline: true },
            { name: "Ticket", value: ticket.id, inline: true },
            { name: "TicketOwnerId", value: ticketOwnerId || "-", inline: true },
            { name: "OrderOwnerId", value: orderOwnerId || "-", inline: true },
            { name: "ExistingOrderId", value: existingOrder.id, inline: true },
          ],
        ).catch(() => null);
      }

      logger?.info?.("order reused", {
        guildId: interaction.guild?.id,
        ticketId: ticket.id,
        actorId: interaction.user?.id,
        existingOrderId: existingOrder.id,
        ownershipMismatch,
      });
    }

    return { ticket, channel, reused };
  }

  async function setOrderStatus(interaction, status) {
    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    if (!ticket) {
      return {
        ok: false,
        message: "Command ini hanya bisa dipakai di ticket.",
      };
    }

    const syncResult = await statusSyncService?.syncTicketOrderQueueStatus({
      guildId: interaction.guild.id,
      ticketId: ticket.id,
      status,
      actorId: interaction.user.id,
      note: "Manual order status update",
      repositories,
    }).catch((error) => {
      logger?.error?.("manual order status sync failed", {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
        status,
        actorId: interaction.user.id,
        message: error.message,
      });
      return null;
    });
    if (syncResult && !syncResult.ok) {
      logger?.warn?.("manual order sync partial failure", {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
        status,
        errors: syncResult.errors,
      });
    }

    if (status === "completed") {
      const opener = await interaction.guild.members.fetch(ticket.openerId).catch((error) => {
        logBestEffort("fetch ticket opener", {
          guildId: interaction.guild.id,
          ticketId: ticket.id,
          openerId: ticket.openerId,
        }, error);
        return null;
      });
      if (opener) {
        await roleService.addRole(opener, roles.member);
      }

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
      }).catch((error) => {
        logBestEffort("send testimoni prompt", { channelId: interaction.channel.id }, error);
      });
    }

    await loggingService.logOrder(
      interaction.guild,
      "Order Status Updated",
      `Status order pada ticket #${ticket.id} diubah menjadi \`${status}\`.`,
      [{ name: "Staff", value: interaction.user.tag, inline: true }],
    );

    if (status === "paid") {
      await loggingService.logPayment(
        interaction.guild,
        "Payment Confirmed",
        `Ticket #${ticket.id} ditandai paid.`,
      );

      const result = shouldAutoQueueJoki(ticket)
        ? await getJokiService?.()?.startQueue?.(interaction, {
          ticketId: ticket.id,
          publishAction: "payment-accepted",
        }).catch((error) => {
          logger?.error?.("auto joki queue after paid status failed", {
            ticketId: ticket.id,
            message: error.message,
          });
          return null;
        })
        : null;

      if (result?.entry) {
        await interaction.channel.send(
          `[AUTO] Payment diterima. Ticket otomatis masuk antrian joki (Order ID: \`${result.entry.id}\`).`,
        ).catch((error) => {
          logBestEffort("send auto queue notice", {
            guildId: interaction.guild.id,
            ticketId: ticket.id,
            channelId: interaction.channel.id,
          }, error);
        });
      }

      const latestOrder = await repositories.orderRepository.findByTicketId(ticket.id).catch((error) => {
        logBestEffort("find latest order for paid hook", {
          guildId: interaction.guild.id,
          ticketId: ticket.id,
        }, error);
        return null;
      });
      if (latestOrder) {
        const detailText =
          ticket?.meta?.detail ||
          ticket?.meta?.paymentNote ||
          ticket?.meta?.budgetPayment ||
          latestOrder.detail ||
          "-";

        await sendOrderSummary(
          interaction.channel,
          "ORDER BARU",
          String(detailText),
          0x57f287,
          {
            ticket,
            interaction,
            product: latestOrder.product,
            order: latestOrder,
            meta: ticket?.meta || {},
          },
          latestOrder.id,
          ticket.id,
        ).catch((error) => {
          logBestEffort("send order summary in paid hook", {
            guildId: interaction.guild.id,
            ticketId: ticket.id,
            orderId: latestOrder.id,
          }, error);
        });

        await sendOrEditInvoice({
          channel: interaction.channel,
          interaction,
          order: latestOrder,
          orderId: latestOrder.id,
          repositories,
        }).catch((error) => {
          logBestEffort("send invoice in paid hook", {
            guildId: interaction.guild.id,
            ticketId: ticket.id,
            orderId: latestOrder.id,
          }, error);
        });
      }
    }

    return {
      ok: true,
      ticket,
    };
  }

  async function closeOrder(interaction, finalStatus = "completed") {
    const statusResult = await setOrderStatus(interaction, finalStatus);
    if (!statusResult.ok) {
      return statusResult;
    }

    const closedTicket = await ticketService.closeTicket(interaction, `Order closed with status ${finalStatus}`);
    return {
      ok: Boolean(closedTicket),
      ticket: closedTicket,
    };
  }

  async function upsertOrderRecord({ ticket, interaction, product, detail }) {
    const formType = ticket.meta?.formType || "general";
    const customerName = ticket.meta?.customerName || "";
    const existingOrder = await repositories.orderRepository.findByTicketId(ticket.id);
    if (!existingOrder) {
      const newOrderId = await repositories.simpleStoreRepository.getNextOrderId(interaction.guild.id);
      await repositories.orderRepository.create(
        createOrder({
          id: newOrderId,
          guildId: interaction.guild.id,
          ticketId: ticket.id,
          userId: interaction.user.id,
          customerName,
          category: formType,
          product,
          detail,
          status: "pending",
          paymentStatus: "unpaid",
        }),
      );
      await repositories.userRepository?.incrementOrder?.(interaction.guild.id, interaction.user.id, interaction.user.tag);
      return newOrderId;
    }

    await repositories.orderRepository.updateByTicketId(ticket.id, {
      customerName,
      category: formType,
      product,
      detail,
      status: "pending",
    });
    return existingOrder.id;
  }

  async function sendOrderSummary(channel, title, detail, color = 0x57f287, context = null, orderId = null, ticketId = null) {
    if (!channel?.isTextBased?.()) {
      return;
    }

    // Priority 1: edit the same embed (orderSummaryMessageId) if available
    let existingOrder = null;
    if (orderId && repositories?.orderRepository?.findById) {
      existingOrder = await repositories.orderRepository.findById(orderId).catch(() => null);
    }

    const summaryEmbed = context
      ? buildOrderSummaryEmbed({
        ...context,
        detail,
        color,
        orderId,
        order: context?.order || existingOrder || null,
      })
      : null;
    const fallbackEmbed = createEmbed({
      title,
      description: clampEmbedDescription(detail, 4096),
      color,
    });

    const existingMessageId = existingOrder?.orderSummaryMessageId || null;
    if (existingMessageId) {
      const messageToEdit = await channel.messages.fetch(existingMessageId).catch(() => null);
      if (messageToEdit?.editable) {
        await messageToEdit.edit({
          content: context?.interaction?.user ? `${context.interaction.user}` : undefined,
          embeds: [summaryEmbed || fallbackEmbed],
          components: [
            new ActionRowBuilder().addComponents(
              require("../components/buttons/closeTicketButton").createCloseTicketButton()
            )
          ]
        }).catch((error) => {
          logBestEffort("edit order summary", { channelId: channel.id, messageId: existingMessageId }, error);
        });
        return;
      }
    }

    // Otherwise create a new summary message and persist messageId
    const sent = await channel.send({
      content: context?.interaction?.user ? `${context.interaction.user}` : undefined,
      embeds: [summaryEmbed || fallbackEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          require("../components/buttons/closeTicketButton").createCloseTicketButton()
        )
      ]
    }).catch((error) => {
      logBestEffort("send order summary", { channelId: channel.id, title }, error);
      return null;
    });

    if (sent?.id && orderId && repositories?.orderRepository?.updateById) {
      await repositories.orderRepository.updateById(orderId, { orderSummaryMessageId: sent.id }).catch(() => null);
    }

    // Spawn Quick Action Panel after creating new order summary
    if (!existingMessageId && context?.interaction?.client?.container?.services?.backlogService?.postQuickActionPanel) {
      await context.interaction.client.container.services.backlogService.postQuickActionPanel({
        channel: channel,
        guild: channel.guild
      }).catch(() => null);
    }

    // keep backward-compat: if only ticketId is available
    if (sent?.id && !orderId && ticketId && repositories?.orderRepository?.updateByTicketId) {
      await repositories.orderRepository.updateByTicketId(ticketId, { orderSummaryMessageId: sent.id }).catch(() => null);
    }
  }

  async function saveOrderForm(interaction, {
    summaryTitle,
    product,
    detail,
    meta,
  }) {
    const relatedTicket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    const safeDetail = clampEmbedDescription(detail, 4096);

    // Jika modal diisi dari dalam channel ticket order milik customer, update data order yang sama.
    if (relatedTicket && relatedTicket.type === "order" && relatedTicket.openerId === interaction.user.id) {
      await repositories.ticketRepository.update(relatedTicket.id, {
        meta: {
          ...(relatedTicket.meta || {}),
          ...meta,
          detail: safeDetail,
          source: "modal",
        },
      });

      const orderId = await upsertOrderRecord({
        ticket: relatedTicket,
        interaction,
        product,
        detail: safeDetail,
      });

      await interaction.editReply({
        content: `[OK] Format order tersimpan (${orderId}). Lanjut klik tombol PAYMENT untuk kirim bukti bayar.`,
      });

      await sendOrderSummary(
        interaction.channel,
        summaryTitle,
        safeDetail,
        0x57f287,
        {
          ticket: relatedTicket,
          interaction,
          product,
          meta,
          orderId,
        },
        orderId,
        relatedTicket.id,
      );
      await loggingService.logOrder(interaction.guild, summaryTitle, safeDetail, [
        { name: "Order ID", value: orderId, inline: true },
        { name: "Customer", value: interaction.user.tag, inline: true },
      ]).catch((error) => {
        logBestEffort("log order summary existing ticket", {
          guildId: interaction.guild.id,
          ticketId: relatedTicket.id,
        }, error);
      });
      return;
    }

    const { ticket, channel } = await ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      "order",
      {
        ...meta,
        detail: safeDetail,
        source: "modal",
      },
    );

    let fullDetail = typeof safeDetail === "string" ? safeDetail : "";

    const userProfile = await repositories.userRepository?.find?.(interaction.guild.id, interaction.user.id);
    if (userProfile && userProfile.tier && userProfile.tier !== "new") {
      const tierMap = { "vip": "10%", "gold": "5%", "silver": "Prioritas Antrian" };
      const benefit = tierMap[userProfile.tier] || "";
      if (benefit) {
        fullDetail += `\n\n⭐ **Loyalty Benefit (${userProfile.tier.toUpperCase()}):** ${benefit}`;
      }
    }

    const orderId = await upsertOrderRecord({
      ticket,
      interaction,
      product,
      detail: fullDetail,
    });

    await interaction.editReply({
      content: `Order ticket kamu sudah dibuat di ${channel} (${orderId}).`,
    });

    await sendOrderSummary(channel, summaryTitle, fullDetail, 0x57f287, {
      ticket,
      interaction,
      product,
      meta,
      orderId,
    });
    await loggingService.logOrder(interaction.guild, summaryTitle, safeDetail, [
      { name: "Order ID", value: orderId, inline: true },
      { name: "Customer", value: interaction.user.tag, inline: true },
    ]).catch((error) => {
      logBestEffort("log order summary new ticket", {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
      }, error);
    });
  }

  async function handleOrderFormModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const gameInfo = getModalValue(interaction.fields, "game_info", "product");
    const targetDeadline = getModalValue(interaction.fields, "target_deadline", "detail");
    const paymentNote = getModalValue(interaction.fields, "payment_note", "contact");

    const product = extractProductFromText(gameInfo, "Order Joki");
    const detail = buildJokiOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      gameInfo,
      targetDeadline,
      paymentNote,
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER JOKI HYPERINDO",
      product,
      detail,
      meta: {
        formType: "joki",
        customerName,
        whatsapp,
        gameInfo,
        targetDeadline,
        paymentNote,
      },
    });
  }

  async function handleTopupFormModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const topupIdentity = getModalValue(interaction.fields, "topup_identity");
    const topupPackage = getModalValue(interaction.fields, "topup_package");
    const topupPayment = getModalValue(interaction.fields, "topup_payment");

    const product = extractProductFromText(topupIdentity, "Order Top Up");
    const detail = buildTopupOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      topupIdentity,
      topupPackage,
      topupPayment,
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER TOP UP HYPERINDO",
      product,
      detail,
      meta: {
        formType: "topup",
        customerName,
        whatsapp,
        topupIdentity,
        topupPackage,
        topupPayment,
      },
    });
  }

  async function handleWarrantyModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const product = interaction.fields.getTextInputValue("product");
    const issue = interaction.fields.getTextInputValue("issue");
    const { channel } = await ticketService.createTicketChannel(interaction.guild, interaction.member, "warranty", {
      product,
      issue,
      source: "modal",
    });

    await interaction.editReply({
      content: `Warranty ticket kamu sudah dibuat di ${channel}.`,
    });
  }

  async function handleWindowsLicenseModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const windowsDetails = getModalValue(interaction.fields, "windows_details");
    const activation = getModalValue(interaction.fields, "windows_status_activation");
    const paymentDetails = getModalValue(interaction.fields, "payment_details");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL ORDER",
          fields: [
            ["PRODUK / EDISI / JUMLAH LISENSI / DEVICE", windowsDetails],
            ["STATUS WINDOWS / BUTUH BANTU AKTIVASI", activation],
          ],
        },
      ],
      paymentInfo: paymentDetails,
      note: "PASTIKAN EDISI WINDOWS SESUAI DENGAN DEVICE KAMU.\nJANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER LISENSI WINDOWS HYPERINDO",
      product: extractProductFromText(windowsDetails, "Lisensi Windows"),
      detail,
      meta: { formType: "windows", customerName, whatsapp, windowsDetails, activation, paymentDetails },
    });
  }

  async function handleOfficeLicenseModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const officeDetails = getModalValue(interaction.fields, "office_details");
    const activationGuide = getModalValue(interaction.fields, "activation_guide");
    const paymentDetails = getModalValue(interaction.fields, "payment_details");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL ORDER",
          fields: [
            ["PRODUK / JUMLAH LISENSI / DEVICE", officeDetails],
            ["BUTUH PANDUAN AKTIVASI / CATATAN", activationGuide],
          ],
        },
      ],
      paymentInfo: paymentDetails,
      note: "PASTIKAN PRODUK OFFICE SESUAI KEBUTUHAN.\nJANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER OFFICE KEY HYPERINDO",
      product: extractProductFromText(officeDetails, "Office Key"),
      detail,
      meta: { formType: "office", customerName, whatsapp, officeDetails, activationGuide, paymentDetails },
    });
  }

  async function handleOptimizerModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const deviceSpecs = getModalValue(interaction.fields, "device_specs");
    const optimizerGoals = getModalValue(interaction.fields, "optimizer_goals");
    const additionalServices = getModalValue(interaction.fields, "additional_services");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        { title: "DETAIL DEVICE", fields: [["SPESIFIKASI DEVICE", deviceSpecs]] },
        {
          title: "DETAIL OPTIMIZER",
          fields: [
            ["TUJUAN / KELUHAN UTAMA", optimizerGoals],
            ["LAYANAN TAMBAHAN / JADWAL", additionalServices],
          ],
        },
      ],
      paymentInfo: "",
      note: "JANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.\nJIKA BUTUH REMOTE, ADMIN AKAN PANDU LEWAT TICKET / CHAT PRIVATE.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER OPTIMIZER WINDOWS HYPERINDO",
      product: "Optimizer Windows",
      detail,
      meta: { formType: "optimizer", customerName, whatsapp, deviceSpecs, optimizerGoals, additionalServices },
    });
  }

  async function handleGameAccountModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const gameDetails = getModalValue(interaction.fields, "game_details");
    const accountRequest = getModalValue(interaction.fields, "account_request");
    const paymentInfo = getModalValue(interaction.fields, "payment_info");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL AKUN",
          fields: [
            ["GAME / JENIS AKUN / PAKET / LOGIN VIA", gameDetails],
            ["REQUEST KHUSUS / BUDGET", accountRequest],
          ],
        },
      ],
      paymentInfo,
      note: "STOK AKUN TANYA ADMIN TERLEBIH DAHULU.\nDATA AKUN DIKIRIM SETELAH PAYMENT SELESAI.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER JUAL AKUN GAME HYPERINDO",
      product: extractProductFromText(gameDetails, "Akun Game"),
      detail,
      meta: { formType: "gameAccount", customerName, whatsapp, gameDetails, accountRequest, paymentInfo },
    });
  }

  async function handleGtaAccountModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const accountType = getModalValue(interaction.fields, "gta_account_type");
    const gtaDetails = getModalValue(interaction.fields, "gta_details");
    const budgetPayment = getModalValue(interaction.fields, "budget_payment");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL AKUN GTA",
          fields: [
            ["JENIS AKUN", accountType],
            ["PLATFORM / LOGIN VIA / REQUEST LEVEL-UANG-ITEM", gtaDetails],
            ["BUDGET / METODE PEMBAYARAN", budgetPayment],
          ],
        },
      ],
      paymentInfo: "",
      note: "HARGA AKUN POLOSAN MULAI DARI 150K.\nSTOK TANYA ADMIN.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER AKUN GTA HYPERINDO",
      product: "Akun GTA",
      detail,
      meta: { formType: "gta", customerName, whatsapp, accountType, gtaDetails, budgetPayment },
    });
  }

  async function handleDiscordServerModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const serverDetails = getModalValue(interaction.fields, "server_details");
    const serverFeatures = getModalValue(interaction.fields, "server_features");
    const paymentInfo = getModalValue(interaction.fields, "payment_info");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL SERVER",
          fields: [
            ["JENIS / TEMA / JUMLAH CHANNEL / JUMLAH ROLE", serverDetails],
            ["BOT / LOGO-BANNER / DEADLINE", serverFeatures],
          ],
        },
      ],
      paymentInfo,
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER JASA SERVER DISCORD HYPERINDO",
      product: "Jasa Server Discord",
      detail,
      meta: { formType: "discordServer", customerName, whatsapp, serverDetails, serverFeatures, paymentInfo },
    });
  }

  async function handleBundlePackageModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const bundleName = getModalValue(interaction.fields, "bundle_name");
    const bundleContents = getModalValue(interaction.fields, "bundle_contents");
    const paymentDeadline = getModalValue(interaction.fields, "payment_deadline");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL BUNDLE",
          fields: [
            ["PAKET BUNDLE YANG DIPILIH", bundleName],
            ["ISI PAKET / GAME-PRODUK / REQUEST TAMBAHAN", bundleContents],
            ["DEADLINE / METODE BAYAR / TOTAL", paymentDeadline],
          ],
        },
      ],
      paymentInfo: "",
      note: "PAKET BUNDLE BISA BERISI JOKI, AKUN, TOP UP, OPTIMIZER, WINDOWS / OFFICE KEY, ATAU JASA DISCORD.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER PAKET BUNDLE HYPERINDO",
      product: extractProductFromText(bundleName, "Paket Bundle"),
      detail,
      meta: { formType: "bundle", customerName, whatsapp, bundleName, bundleContents, paymentDeadline },
    });
  }

  logger?.info?.("order service ready", { store: botConfig.storeName });

  return {
    openOrder,
    setOrderStatus,
    closeOrder,
    handleOrderFormModal,
    handleTopupFormModal,
    handleWarrantyModal,
    handleWindowsLicenseModal,
    handleOfficeLicenseModal,
    handleOptimizerModal,
    handleGameAccountModal,
    handleGtaAccountModal,
    handleDiscordServerModal,
    handleBundlePackageModal,

    // Priority 1 invoice automation
    sendOrderSummary,
    sendOrEditInvoice,
    buildInvoiceEmbed,
  };
}

module.exports = {
  createOrderService,
};
