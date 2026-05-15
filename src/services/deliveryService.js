const { createEmbed } = require("../utils/embed");
const { createStockRepository } = require("../repositories/stockRepository");

function createDeliveryService({ botConfig, logger, database, repositories, loggingService }) {
  const stockRepo = createStockRepository(database);

  // In-flight lock to prevent concurrent reserve+DM for the same stock unit
  // within a single process (unit tests / race simulations).
  const inFlightLocks = createDeliveryService._inFlightLocks || (createDeliveryService._inFlightLocks = new Map());

  async function withUnitLock(key, fn) {
    const existing = inFlightLocks.get(key);
    if (existing) {
      await existing;
    }
    let resolveNext = null;
    const nextPromise = new Promise((resolve) => { resolveNext = resolve; });
    inFlightLocks.set(key, nextPromise);

    try {
      return await fn();
    } finally {
      inFlightLocks.delete(key);
      resolveNext();
    }
  }

  function maskValue(value) {
    if (!value) return "[non-digital]";
    const s = String(value);
    if (s.length <= 6) return "***";
    return `${s.slice(0, 3)}***${s.slice(-2)}`;
  }

  async function tryAutoDeliver(guild, ticketId) {
    const order = await repositories.orderRepository.findByTicketId(ticketId);
    if (!order || !order.sku) {
      return { ok: false, reason: "no-sku", message: "Order tidak punya SKU terkait." };
    }

    const item = await stockRepo.stockItems.findBySku(guild.id, order.sku);
    if (!item) {
      return { ok: false, reason: "item-not-found", message: `Item SKU ${order.sku} tidak ditemukan.` };
    }

    if (item.deliveryType !== "auto") {
      return { ok: false, reason: "manual-delivery", message: "Item ini manual delivery." };
    }

    if (!["digital", "bundle"].includes(item.type)) {
      return { ok: false, reason: "not-digital", message: "Item bukan digital/bundle." };
    }

    // Anti-double delivery:
    // 1) Jika sudah pernah sold => blok.
    // 2) Jika sedang reserved oleh order ini (delivery sedang berjalan) => blok (mencegah DM dobel sebelum jadi sold).
    const allUnits = await stockRepo.stockUnits.getAll(guild.id);
    const alreadyDelivered = allUnits.find((u) => u.soldToOrderId === order.id);
    if (alreadyDelivered) {
      return { ok: false, reason: "already-delivered", message: `Order ${order.id} sudah pernah dikirim.` };
    }

    const alreadyReserved = allUnits.find((u) => u.reservedByOrderId === order.id && u.status === "reserved");
    if (alreadyReserved) {
      return {
        ok: false,
        reason: "already-reserved",
        message: `Order ${order.id} sedang diproses delivery (unit reserved).`,
      };
    }

    // Get available unit
    const availableUnits = await stockRepo.stockUnits.findAvailableUnitsByItemId(guild.id, item.id);
    if (!availableUnits.length) {
      await logDelivery(guild, order, null, false, "Out of stock");
      return { ok: false, reason: "out-of-stock", message: `Stok habis untuk SKU ${order.sku}.` };
    }

    const unit = availableUnits[0];

    // Critical section lock per stock unit:
    // ensures only one concurrent delivery can reserve+DM+sell the same unit.
    const lockKey = `${guild.id}|${unit.id}`;
    return await withUnitLock(lockKey, async () => {
      // Re-check unit status inside lock
      const latestUnit = await stockRepo.stockUnits.findById(unit.id);
      if (!latestUnit || latestUnit.status !== "available") {
        return { ok: false, reason: "unit-not-available", message: "Unit already reserved by another delivery." };
      }

      // Reserve unit
      await stockRepo.stockUnits.updateById(unit.id, {
        status: "reserved",
        reservedByOrderId: order.id,
        reservedAt: new Date().toISOString(),
      });

      // Send DM to customer
      const dmSuccess = await sendDigitalProductDM(guild, order, item, unit);

      if (dmSuccess) {
        // Mark as sold
        await stockRepo.stockUnits.updateById(unit.id, {
          status: "sold",
          soldToOrderId: order.id,
          deliveredAt: new Date().toISOString(),
        });
        await logDelivery(guild, order, unit, true, "Auto delivery success");
        return { ok: true, unit, message: "Produk berhasil dikirim ke DM customer." };
      }

      // DM failed — revert to available
      await stockRepo.stockUnits.updateById(unit.id, {
        status: "available",
        reservedByOrderId: null,
        reservedAt: null,
      });
      await logDelivery(guild, order, unit, false, "DM gagal / customer DM tertutup");
      return { ok: false, reason: "dm-failed", message: "Gagal kirim DM ke customer. Unit dikembalikan ke available." };
    });
  }

  async function sendDigitalProductDM(guild, order, item, unit) {
    try {
      const member = await guild.members.fetch(order.userId).catch(() => null);
      if (!member) return false;

      const embed = createEmbed({
        title: "📦 Produk Digital — HYPERINDO",
        description: [
          `**Order ID**: ${order.id}`,
          `**Produk**: ${item.name}`,
          `**SKU**: ${item.sku}`,
          "",
          "**Detail Produk:**",
          "```",
          unit.valueEncrypted || "[Lihat ticket untuk detail]",
          "```",
          "",
          "⚠️ Simpan data di atas dengan baik.",
          "Jika ada masalah, buka ticket warranty di server.",
        ].join("\n"),
        color: 0x2ecc71,
        footer: guild.name,
      });

      await member.send({ embeds: [embed] });
      return true;
    } catch (error) {
      logger?.warn?.("DM delivery failed", {
        guildId: guild.id,
        userId: order.userId,
        orderId: order.id,
        error: error.message,
      });
      return false;
    }
  }

  async function logDelivery(guild, order, unit, success, note) {
    const fields = [
      { name: "Order ID", value: order.id, inline: true },
      { name: "SKU", value: order.sku || "-", inline: true },
      { name: "Customer", value: `<@${order.userId}>`, inline: true },
      { name: "Status", value: success ? "✅ Delivered" : "❌ Failed", inline: true },
    ];

    if (unit) {
      fields.push({ name: "Unit ID", value: unit.id, inline: true });
      fields.push({ name: "Value", value: maskValue(unit.valueEncrypted), inline: true });
    }

    if (note) {
      fields.push({ name: "Note", value: note, inline: false });
    }

    await loggingService?.logOrder?.(
      guild,
      success ? "Auto Delivery Success" : "Auto Delivery Failed",
      `Order ${order.id} — ${success ? "berhasil" : "gagal"} dikirim otomatis.`,
      fields,
    ).catch((error) => logger?.warn?.("deliveryService logOrder failed", { error: error?.message ?? String(error), stack: error?.stack, orderId: order.id }));
  }

  async function getDeliveryStatus(guildId, orderId) {
    const order = await repositories.orderRepository.findById(orderId);
    if (!order) return null;

    const allUnits = await stockRepo.stockUnits.getAll(guildId);
    const reservedUnit = allUnits.find((u) => u.reservedByOrderId === orderId);
    const soldUnit = allUnits.find((u) => u.soldToOrderId === orderId);

    return {
      order,
      reservedUnit: reservedUnit || null,
      soldUnit: soldUnit || null,
      delivered: Boolean(soldUnit),
    };
  }

  async function notifyTicketChannel(guild, ticketId, message, success = true) {
    const ticket = await repositories.ticketRepository?.findById?.(ticketId);
    if (!ticket?.channelId) return;

    const channel = guild.channels.cache.get(ticket.channelId) ||
      await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return;

    await channel.send({
      content: `${success ? "✅" : "⚠️"} ${message}`,
    }).catch((error) => logger?.warn?.("deliveryService notifyTicketChannel send failed", { error: error?.message ?? String(error), stack: error?.stack, channelId: channel?.id, ticketId }));
  }

  logger?.info?.("delivery service ready");

  return {
    tryAutoDeliver,
    getDeliveryStatus,
    notifyTicketChannel,
  };
}

module.exports = {
  createDeliveryService,
};
