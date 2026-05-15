const { MessageFlags, EmbedBuilder } = require("discord.js");
const { componentIds } = require("../utils/constants");

async function handleSelectMenu(client, interaction) {
  const { services } = client.container;

  // Anti-spam / rate limiter for select menu interactions
  if (services?.rateLimitService?.checkInteraction) {
    const rate = await services.rateLimitService.checkInteraction(interaction);
    if (!rate.allowed) {
      return interaction.reply({
        content: rate.message || "Rate limit exceeded. Coba lagi sebentar.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  }

  // setup wizard (admin)
  if (interaction.customId === componentIds.setupModeSelect) {
    const { isOwnerOrStaff } = require("../utils/permissionCheck");

    if (!isOwnerOrStaff(interaction.member)) {
      return interaction.reply({ content: "Akses admin saja.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const mode = interaction.values?.[0];
    if (!mode) {
      return interaction.reply({ content: "Mode setup tidak valid.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

    const embed = new EmbedBuilder()
      .setTitle("🧭 Setup Wizard")
      .setColor(0x57f287)
      .setDescription(`Mode yang dipilih: **\`${mode}\`**\n\nKlik **Mulai Setup** untuk menjalankan setup.`)
      .setFooter({ text: "HYPEBOTX" });

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${componentIds.setupConfirmButton}:${mode}`)
        .setLabel("✅ Mulai Setup")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(componentIds.setupBackToAdminPanelButton)
        .setLabel("⬅️ Kembali")
        .setStyle(ButtonStyle.Secondary),
    );

    // no persistent state; encode mode into confirm button customId
    return interaction.update({
      embeds: [embed],
      components: [confirmRow],
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  }

  if (interaction.customId === componentIds.roleSelect) {
    return services.verifyService.handleRoleSelect(interaction);
  }

  if (interaction.customId === componentIds.ticketTypeSelect) {
    return services.ticketService.handleTicketSelect(interaction, interaction.values[0]);
  }

  if (interaction.customId === componentIds.orderStatusSelect) {
    const status = interaction.values[0];
    const result = await services.orderService.setOrderStatus(interaction, status);
    await interaction.reply({
      content: result.ok ? `Status order diubah ke \`${status}\`.` : result.message,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId === componentIds.priceCategorySelect) {
    return handlePriceCategorySelect(client, interaction);
  }

  return null;
}

/** Category display metadata */
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

async function handlePriceCategorySelect(client, interaction) {
  const selected = interaction.values[0];
  const storeName = client.container.botConfig.storeName || "HYPERINDO";

  // Terms
  if (selected === "terms") {
    const { KETENTUAN } = require("../config/pricelist");
    const lines = KETENTUAN.map((rule, i) => `${i + 1}. ${rule}`);
    const embed = new EmbedBuilder()
      .setTitle("📜 Syarat & Ketentuan")
      .setDescription(lines.join("\n"))
      .setColor(0xed4245)
      .setFooter({ text: `${storeName} — Dengan melakukan order berarti menyetujui semua ketentuan` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  // Category detail
  const priceRows = await client.container.services.storeOpsService.getPriceList(interaction.guild.id);
  const items = priceRows.filter((r) => r.category === selected);

  if (!items.length) {
    await interaction.reply({
      content: `Kategori **${selected}** kosong atau tidak ditemukan.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const meta = CATEGORY_META[selected] || { color: 0x5865f2, emoji: "📋" };
  const isPaket = selected === "📦 Paket Bundling";

  const embed = new EmbedBuilder()
    .setTitle(selected)
    .setColor(meta.color)
    .setFooter({ text: `${storeName} — GTA V Online Legacy / Enhanced` })
    .setTimestamp();

  if (isPaket) {
    for (const item of items) {
      const descLines = (item.description || "").split("\n").map((l) => `┗ ${l}`).join("\n");
      embed.addFields({
        name: `${meta.emoji} ${item.name} — ${item.price}`,
        value: descLines || "-",
        inline: false,
      });
    }
  } else {
    const lines = items.map((item) => {
      const desc = item.description ? `\n  ┗ *${item.description.split("\n")[0]}*` : "";
      return `${meta.emoji} **${item.name}** — ${item.price}${desc}`;
    });
    embed.setDescription(lines.join("\n"));
  }

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = {
  handleSelectMenu,
};
