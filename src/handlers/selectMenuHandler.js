const {
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { componentIds } = require("../utils/constants");
const { safeReply } = require("../utils/discordResponse.js");
const { requireVerifiedMember } = require("../middlewares/permissionGuard");
const { isOwnerOrStaff } = require("../utils/permissionCheck");

async function handleSelectMenu(client, interaction) {
  const { services } = client.container;

  if (services?.rateLimitService?.checkInteraction) {
    const rate = await services.rateLimitService.checkInteraction(interaction);
    if (!rate.allowed) {
      return safeReply(interaction, {
        content: rate.message || "Rate limit exceeded. Coba lagi sebentar.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  }

  if ([
    componentIds.orderServiceSelect,
    componentIds.orderProductSelect,
    componentIds.orderPackageSelect,
    componentIds.orderMethodSelect,
    componentIds.orderNeedTypeSelect,
    componentIds.orderPaymentSelect,
  ].includes(interaction.customId)) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }
    return services.orderService.handleCheckoutSelectInteraction?.(interaction);
  }

  if (interaction.customId === componentIds.setupModeSelect) {
    if (!isOwnerOrStaff(interaction.member)) {
      return safeReply(interaction, { content: "Akses admin saja.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const mode = interaction.values?.[0];
    if (!mode) {
      return safeReply(interaction, { content: "Mode setup tidak valid.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const embed = new EmbedBuilder()
      .setTitle("Setup Wizard")
      .setColor(0x57f287)
      .setDescription(`Mode yang dipilih: **\`${mode}\`**\n\nKlik **Mulai Setup** untuk menjalankan setup.`)
      .setFooter({ text: "HYPEBOTX" });

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${componentIds.setupConfirmButton}:${mode}`)
        .setLabel("Mulai Setup")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(componentIds.setupBackToAdminPanelButton)
        .setLabel("Kembali")
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.update({
      embeds: [embed],
      components: [confirmRow],
    }).catch(() => null);
  }

  if (interaction.customId === componentIds.roleSelect) {
    return services.verifyService.handleRoleSelect(interaction);
  }

  if (interaction.customId === componentIds.ticketTypeSelect) {
    return services.ticketService.handleTicketSelect(interaction, interaction.values[0]);
  }

  if (interaction.customId === componentIds.orderStatusSelect) {
    if (!isOwnerOrStaff(interaction.member)) {
      await safeReply(interaction, {
        content: "Hanya staff/admin yang bisa ubah status order.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return null;
    }

    const status = interaction.values[0];
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const result = await services.orderService.setOrderStatus(interaction, status);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: result.ok ? `Status order diubah ke \`${status}\`.` : result.message,
        }).catch(() => null);
      } else {
        await safeReply(interaction, {
          content: result.ok ? `Status order diubah ke \`${status}\`.` : result.message,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    } catch {
      // ignore noisy reply errors
    }
    return null;
  }

  if (interaction.customId === componentIds.priceCategorySelect) {
    return handlePriceCategorySelect(client, interaction);
  }

  return null;
}

const CATEGORY_META = {
  "Paket Bundling": { color: 0xf39c12, emoji: "[BUNDLE]" },
  "Migrasi": { color: 0x607d8b, emoji: "[MIGRASI]" },
};

async function handlePriceCategorySelect(client, interaction) {
  const selected = interaction.values[0];
  const storeName = client.container.botConfig.storeName || "HYPERINDO";

  if (selected === "terms") {
    const { KETENTUAN } = require("../config/pricelist");
    const lines = KETENTUAN.map((rule, i) => `${i + 1}. ${rule}`);
    const embed = new EmbedBuilder()
      .setTitle("Syarat & Ketentuan")
      .setDescription(lines.join("\n"))
      .setColor(0xed4245)
      .setFooter({ text: `${storeName} - Dengan melakukan order berarti menyetujui semua ketentuan` })
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => null);
    return;
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  const priceRows = await client.container.services.storeOpsService.getPriceList(interaction.guild.id);
  const items = priceRows.filter((row) => row.category === selected);

  if (!items.length) {
    await safeReply(interaction, {
      content: `Kategori **${selected}** kosong atau tidak ditemukan.`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
    return;
  }

  const meta = CATEGORY_META[selected] || { color: 0x5865f2, emoji: "[ITEM]" };
  const embed = new EmbedBuilder()
    .setTitle(selected)
    .setColor(meta.color)
    .setFooter({ text: `${storeName} - Pricelist` })
    .setTimestamp();

  const lines = items.map((item) => {
    const description = item.description ? `\n  - ${item.description.split("\n")[0]}` : "";
    return `${meta.emoji} **${item.name}** - ${item.price}${description}`;
  });
  embed.setDescription(lines.join("\n"));

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    } else {
      await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  } catch {
    // ignore
  }
}

module.exports = {
  handleSelectMenu,
};
