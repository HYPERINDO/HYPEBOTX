const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { clampContent } = require("../../utils/discordResponse");
const { createStockRepository } = require("../../repositories/stockRepository");
const { KETENTUAN, getGroupedProducts } = require("../../config/pricelist");
const { sanitizeText } = require("../../utils/validators");

/** Category display metadata — colors & emoji per category */
const CATEGORY_META = {
  "1️⃣ Special / Bonus": { color: 0xf1c40f, emoji: "✨" },
  "2️⃣ Recovery": { color: 0xe74c3c, emoji: "🔧" },
  "3️⃣ Kendaraan": { color: 0x3498db, emoji: "🚗" },
  "4️⃣ Money Heist": { color: 0x2ecc71, emoji: "💰" },
  "5️⃣ Rank Boost": { color: 0x9b59b6, emoji: "📈" },
  "6️⃣ Max Stats": { color: 0xe67e22, emoji: "💪" },
  "7️⃣ Unlock Package": { color: 0x1abc9c, emoji: "🔓" },
  "8️⃣ Property / Bisnis": { color: 0x95a5a6, emoji: "🏠" },
  "📦 Paket Bundling": { color: 0xf39c12, emoji: "📦" },
  "🔄 Migrasi": { color: 0x607d8b, emoji: "🔄" },
};

function formatStockStatus({ sku, availableCount }) {
  if (!sku) return "";
  return availableCount > 0 ? ` ✅ (${availableCount})` : ` ❌ Habis`;
}

function groupByCategory(rows) {
  const categories = new Map();
  for (const row of rows) {
    const category = row.category || "general";
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(row);
  }
  return categories;
}

/**
 * Build embed for a single category.
 */
function buildCategoryEmbed(category, items, skuToAvailable, storeName) {
  const meta = CATEGORY_META[category] || { color: 0x5865f2, emoji: "📋" };

  const lines = items.map((item) => {
    const stock = item.sku ? formatStockStatus({ sku: item.sku, availableCount: skuToAvailable.get(item.sku) ?? 0 }) : "";
    const desc = item.description ? `\n  ┗ *${item.description.split("\n")[0]}*` : "";
    return `${meta.emoji} **${item.name}** — ${item.price}${stock}${desc}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`${category}`)
    .setDescription(lines.join("\n"))
    .setColor(meta.color)
    .setFooter({ text: `${storeName} — GTA V Online Legacy / Enhanced` })
    .setTimestamp();

  return embed;
}

/**
 * Build the paket embed with full descriptions.
 */
function buildPaketEmbed(category, items, storeName) {
  const meta = CATEGORY_META[category] || { color: 0xf39c12, emoji: "📦" };

  const embed = new EmbedBuilder()
    .setTitle(`${category}`)
    .setColor(meta.color)
    .setFooter({ text: `${storeName} — GTA V Online Legacy / Enhanced` })
    .setTimestamp();

  for (const item of items) {
    const descLines = (item.description || "").split("\n").map((l) => `┗ ${l}`).join("\n");
    embed.addFields({
      name: `${meta.emoji} ${item.name} — ${item.price}`,
      value: descLines || "-",
      inline: false,
    });
  }

  return embed;
}

/**
 * Build the terms/ketentuan embed.
 */
function buildTermsEmbed(storeName) {
  const lines = KETENTUAN.map((rule, i) => `${i + 1}. ${rule}`);
  return new EmbedBuilder()
    .setTitle("📜 Syarat & Ketentuan")
    .setDescription(lines.join("\n"))
    .setColor(0xed4245)
    .setFooter({ text: `${storeName} — Dengan melakukan order berarti menyetujui semua ketentuan` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("price")
    .setDescription("Lihat price list HYPERINDO.")
    .addStringOption((option) =>
      option
        .setName("kategori")
        .setDescription("Lihat kategori tertentu")
        .setRequired(false)
        .addChoices(
          { name: "🔥 Semua (ringkas)", value: "all" },
          { name: "✨ Special / Bonus", value: "1️⃣ Special / Bonus" },
          { name: "🔧 Recovery", value: "2️⃣ Recovery" },
          { name: "🚗 Kendaraan", value: "3️⃣ Kendaraan" },
          { name: "💰 Money Heist", value: "4️⃣ Money Heist" },
          { name: "📈 Rank Boost", value: "5️⃣ Rank Boost" },
          { name: "💪 Max Stats", value: "6️⃣ Max Stats" },
          { name: "🔓 Unlock Package", value: "7️⃣ Unlock Package" },
          { name: "🏠 Property / Bisnis", value: "8️⃣ Property / Bisnis" },
          { name: "📦 Paket Bundling", value: "📦 Paket Bundling" },
          { name: "🔄 Migrasi", value: "🔄 Migrasi" },
          { name: "📜 Syarat & Ketentuan", value: "terms" },
        ),
    ),
  async execute(interaction, client) {
    const storeName = client.container.botConfig.storeName || "HYPERINDO";
    const priceRows = await client.container.services.storeOpsService.getPriceList(interaction.guild.id);

    if (!priceRows.length) {
      const { safeReply } = require("../../utils/discordResponse");
      await safeReply(interaction, { content: "Price list belum diisi. Hubungi admin untuk seed data.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    const stockRepo = createStockRepository(client.container.database);

    // Precompute stock availability
    const skuToAvailable = new Map();
    const uniqueSkus = [...new Set(priceRows.map((r) => r.sku).filter(Boolean))];
    for (const sku of uniqueSkus) {
      const item = await stockRepo.stockItems.findBySku(interaction.guild.id, sku).catch(() => null);
      if (!item) {
        skuToAvailable.set(sku, 0);
        continue;
      }
      const count = await stockRepo.stockUnits.countAvailableByItemId(interaction.guild.id, item.id).catch(() => 0);
      skuToAvailable.set(sku, count || 0);
    }

    const selectedCategory = sanitizeText(interaction.options.getString("kategori"), 500) || "all";
    const grouped = groupByCategory(priceRows);

    // Terms request
    if (selectedCategory === "terms") {
      await safeReply(interaction, {
        embeds: [buildTermsEmbed(storeName)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Specific category
    if (selectedCategory !== "all") {
      const items = grouped.get(selectedCategory);
      if (!items || !items.length) {
        const { safeReply } = require("../../utils/discordResponse");
        await safeReply(interaction, { content: `Kategori **${selectedCategory}** kosong / tidak ditemukan.`, flags: MessageFlags.Ephemeral }).catch(() => null);
        return;
      }

      const isPaket = selectedCategory === "📦 Paket Bundling";
      const embed = isPaket
        ? buildPaketEmbed(selectedCategory, items, storeName)
        : buildCategoryEmbed(selectedCategory, items, skuToAvailable, storeName);

      await safeReply(interaction, {
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // "All" — send overview embeds (max 10 embeds per message)
    const embeds = [];

    // Header embed
    const headerEmbed = new EmbedBuilder()
      .setTitle(`🎮 ${storeName} — GTA V Online Price List`)
      .setDescription([
        "Berlaku untuk **Legacy & Enhanced** (harga sama)",
        "Money dari hasil run heist, bukan drop money",
        "",
        "Pilih kategori di bawah untuk detail lengkap,",
        "atau scroll untuk melihat ringkasan semua layanan.",
      ].join("\n"))
      .setColor(0x5865f2)
      .setTimestamp();
    embeds.push(headerEmbed);

    // Build compact embed per category (limit fields for Discord)
    for (const [category, items] of grouped.entries()) {
      if (category === "📦 Paket Bundling") {
        embeds.push(buildPaketEmbed(category, items, storeName));
      } else {
        embeds.push(buildCategoryEmbed(category, items, skuToAvailable, storeName));
      }
    }

    // Discord limit: max 10 embeds per message
    const batch1 = embeds.slice(0, 10);
    const batch2 = embeds.slice(10);

    // Build select menu for detailed browsing
    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("price_category_select")
        .setPlaceholder("🔍 Pilih kategori untuk detail...")
        .addOptions(
          [...grouped.keys()].map((cat) => {
            const meta = CATEGORY_META[cat] || { emoji: "📋" };
            const count = grouped.get(cat)?.length || 0;
            return {
              label: cat.replace(/^[^\s]+\s/, ""),
              description: `${count} layanan`,
              value: cat,
              emoji: meta.emoji,
            };
          }),
          {
            label: "Syarat & Ketentuan",
            description: "Baca syarat & ketentuan order",
            value: "terms",
            emoji: "📜",
          },
        ),
    );

    const { safeReply } = require("../../utils/discordResponse");
    await safeReply(interaction, { embeds: batch1, components: [selectRow], flags: MessageFlags.Ephemeral }).catch(() => null);

    if (batch2.length) {
      await interaction.followUp({
        embeds: batch2,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
