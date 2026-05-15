const { componentIds } = require("../utils/constants");
const { createOrderFormModal } = require("../components/modals/orderFormModal");
const { createTopupFormModal } = require("../components/modals/topupFormModal");
const { createWarrantyModal } = require("../components/modals/warrantyModal");
const { createWindowsLicenseModal, createOfficeLicenseModal } = require("../components/modals/licensesModal");
const { createOptimizerModal, createGameAccountModal } = require("../components/modals/servicesModal");
const { createDiscordServerModal, createBundlePackageModal } = require("../components/modals/advancedOrderModal");
const { requireVerifiedMember } = require("../middlewares/permissionGuard");
const { createOrderFormatEmbed, getFormatTypeFromButtonId } = require("../utils/orderFormatHelper");
const { MessageFlags } = require("discord.js");

const { createPaymentRejectReasonModal } = require("../components/modals/paymentRejectReasonModal");
const { createWarrantyNeedProofReasonModal } = require("../components/modals/warrantyNeedProofReasonModal");
const { createTestimoniModal } = require("../components/modals/testimoniModal");
const { safeReply } = require("../utils/discordResponse.js");

const formatModalFactories = {
  [componentIds.formatJoki]: createOrderFormModal,
  [componentIds.formatTopup]: createTopupFormModal,
  [componentIds.formatWindows]: createWindowsLicenseModal,
  [componentIds.formatOffice]: createOfficeLicenseModal,
  [componentIds.formatOptimizer]: createOptimizerModal,
  [componentIds.formatGameaccount]: createGameAccountModal,
  [componentIds.formatDiscord]: createDiscordServerModal,
  [componentIds.formatBundle]: createBundlePackageModal,
  [componentIds.formatWarranty]: createWarrantyModal,
};

async function handleButton(client, interaction) {
  const { services, repositories } = client.container;
  const requireTerms = String(process.env.REQUIRE_TERMS_ACCEPT || "true").toLowerCase() !== "false";

  function resolveTicketChannelLabel(channel, ticketId = null) {
    const channelId = channel?.id ? String(channel.id) : null;
    if (channelId) {
      // Mention format is the most stable across text channel + thread.
      return `<#${channelId}>`;
    }

    if (typeof channel === "string" && channel.trim()) {
      return channel.trim();
    }

    if (ticketId) {
      return `ticket #${ticketId}`;
    }

    return "ticket kamu";
  }

  // Anti-spam / rate limiter for button interactions
  if (services?.rateLimitService?.checkInteraction) {
    const rate = await services.rateLimitService.checkInteraction(interaction);
    if (!rate.allowed) {
      services?.loggingService?.logSecurity?.(
        interaction.guild,
        "Rate Limit Denied",
        `Button interaction rate-limited. customId=${interaction.customId}`,
        [
          { name: "Actor", value: interaction.user.tag, inline: true },
          { name: "User ID", value: interaction.user.id, inline: true },
          { name: "CustomID", value: interaction.customId, inline: false },
          { name: "Reason", value: rate.message || "-", inline: false },
        ],
      ).catch(() => null);

      return safeReply(interaction, {
        content: rate.message || "Rate limit exceeded. Coba lagi sebentar.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  }

  async function ensureTermsAcceptedForCustomer() {
    if (!requireTerms) return true;
    if (!services?.backlogService?.hasAcceptedTerms) return true;
    const accepted = await services.backlogService.hasAcceptedTerms(interaction.guild.id, interaction.user.id).catch(() => true);
    if (accepted) return true;
    await safeReply(interaction, {
      content: "Kamu perlu menerima SOP / Terms dulu. Minta staff kirim panel Terms lalu klik tombol setuju.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
    return false;
  }

  // Maintenance hard-block (customer flow) - staff/owner bypass
  const { checkMaintenanceForButton } = require("../middlewares/maintenanceGuard");
  const ok = await checkMaintenanceForButton(interaction, repositories);
  if (!ok) return;

  // Joki buttons
  if (interaction.customId.startsWith(componentIds.jokiClaimPrefix)) {
    const orderId = interaction.customId.slice(componentIds.jokiClaimPrefix.length);
    try {
      return await services.jokiService.handleClaimButton?.(interaction, orderId);
    } catch (error) {
      const { createFeatureErrorLogger } = require("../utils/featureErrorLogger");
      const featureErrorLogger = createFeatureErrorLogger({
        logger: client.container.logger,
        loggingService: client.container.services?.loggingService,
        botConfig: client.container.botConfig,
      });
      await featureErrorLogger.capture({
        interaction,
        feature: "button:jokiClaim",
        error,
      });
      throw error;
    }
  }

  if (interaction.customId.startsWith(componentIds.jokiStartPrefix)) {
    const orderId = interaction.customId.slice(componentIds.jokiStartPrefix.length);
    try {
      return await services.jokiService.handleStartButton?.(interaction, orderId);
    } catch (error) {
      const { createFeatureErrorLogger } = require("../utils/featureErrorLogger");
      const featureErrorLogger = createFeatureErrorLogger({
        logger: client.container.logger,
        loggingService: client.container.services?.loggingService,
        botConfig: client.container.botConfig,
      });
      await featureErrorLogger.capture({
        interaction,
        feature: "button:jokiStart",
        error,
      });
      throw error;
    }
  }

  if (interaction.customId.startsWith(componentIds.jokiFinishPrefix)) {
    const orderId = interaction.customId.slice(componentIds.jokiFinishPrefix.length);
    try {
      return await services.jokiService.handleFinishButton?.(interaction, orderId);
    } catch (error) {
      const { createFeatureErrorLogger } = require("../utils/featureErrorLogger");
      const featureErrorLogger = createFeatureErrorLogger({
        logger: client.container.logger,
        loggingService: client.container.services?.loggingService,
        botConfig: client.container.botConfig,
      });
      await featureErrorLogger.capture({
        interaction,
        feature: "button:jokiFinish",
        error,
      });
      throw error;
    }
  }

  if (interaction.customId === componentIds.verifyButton) {
    return services.verifyService.handleVerifyButton(interaction);
  }

  if (interaction.customId === componentIds.termsAcceptButton) {
    if (!services?.backlogService?.acceptTerms) return null;
    const acceptedAt = await services.backlogService.acceptTerms(interaction).catch(() => null);
    await safeReply(interaction, {
      content: acceptedAt
        ? `SOP / Terms berhasil diterima pada ${acceptedAt}.`
        : "Gagal menyimpan acceptance SOP / Terms.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
    return null;
  }

  if (interaction.customId === componentIds.ticketClaim) {
    try {
      return services.ticketService.claimTicket(interaction);
    } catch (error) {
      const code = error?.code;
      const message = String(error?.message || "").toLowerCase();
      const unknownInteraction = code === 10062 || message.includes("unknown interaction");

      if (unknownInteraction) {
        services?.loggingService?.logSecurity?.(
          interaction.guild,
          "Blocked Interaction - Ticket Claim (Unknown Interaction)",
          `Ignored ticket claim due to unknown/expired interaction. customId=${interaction.customId}`,
          [
            { name: "Actor", value: interaction?.user?.tag || "-", inline: true },
            { name: "User ID", value: interaction?.user?.id || "-", inline: true },
            { name: "CustomID", value: interaction?.customId || "-", inline: false },
            { name: "Error", value: error?.message || "-", inline: false },
          ],
        ).catch(() => null);

        client.container.logger?.warn?.("ticket claim ignored: unknown interaction", {
          customId: interaction.customId,
          actorId: interaction?.user?.id,
          isReplied: Boolean(interaction?.replied),
          isDeferred: Boolean(interaction?.deferred),
          code,
          message: error?.message,
        });
        return null;
      }

      throw error;
    }
  }

  if (interaction.customId.startsWith(componentIds.ticketCloseConfirmPrefix)) {
    const token = interaction.customId.slice(componentIds.ticketCloseConfirmPrefix.length);
    return services.ticketService.handleCloseConfirmation?.(interaction, token, true);
  }

  if (interaction.customId.startsWith(componentIds.ticketCloseCancelPrefix)) {
    const token = interaction.customId.slice(componentIds.ticketCloseCancelPrefix.length);
    return services.ticketService.handleCloseConfirmation?.(interaction, token, false);
  }

  if (interaction.customId === componentIds.ticketClose || interaction.customId === "ticket:customerClose") {
    if (services.ticketService.requestCloseTicket) {
      return services.ticketService.requestCloseTicket(interaction, "Closed from button");
    }
    return services.ticketService.closeTicket(interaction, "Closed from button");
  }

  if (interaction.customId === componentIds.ticketOrderButton || interaction.customId === componentIds.customerSimpleOrderButton) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }
    if (!(await ensureTermsAcceptedForCustomer())) {
      return null;
    }

    const { MessageFlags } = require("discord.js");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Only "ORDER SEKARANG" gets step-by-step based on last order status
    if (interaction.customId === componentIds.customerSimpleOrderButton) {
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      const orders = await repositories.orderRepository.findByUserId(guildId, userId).catch(() => []);
      const lastOrder = Array.isArray(orders) && orders.length ? orders.slice(-1)[0] : null;

      const rawStatus = String(lastOrder?.status || "").toLowerCase();
      const rawPaymentStatus = String(lastOrder?.paymentStatus || "").toLowerCase();

      // Flow final wajib (selalu tampil posisi order yang jelas)
      // Status wajib:
      // - Menunggu Pembayaran
      // - Menunggu Konfirmasi
      // - Diproses
      // - Selesai
      // - Revisi
      // - Dibatalkan
      const state = (() => {
        const status = rawStatus;
        const payment = rawPaymentStatus;

        // 1) Final terminal: Selesai
        if (["completed", "done", "selesai", "completed-orders"].includes(status)) return "selesai";

        // 2) Revisi (umumnya refund/reject payment/edit yang menghasilkan revisi)
        if (["refunded", "refund", "revised", "revision", "revisi"].includes(status) || ["refunded", "refund"].includes(payment)) {
          return "revisi";
        }

        // 3) Dibatalkan
        if (["cancelled", "canceled", "cancel", "dibatalkan", "rejected", "declined"].includes(status)) return "dibatalkan";
        if (["cancelled", "canceled", "rejected", "declined"].includes(payment)) return "dibatalkan";

        // 4) Pembayaran belum valid/ belum diproses
        // payment: submitted/unpaid/waiting
        if (["submitted", "unpaid", "waiting", "waiting-payment", "waiting_payment", "waitingpayment"].includes(payment)) return "menunggu_pembayaran";

        // 5) Menunggu konfirmasi admin
        // order status waiting/ menunggu-konfirmasi
        if (["waiting", "waiting-payment", "waiting_payment", "menunggu-konfirmasi", "menunggu_konfirmasi"].includes(status)) return "menunggu_konfirmasi";

        // 6) Diproses (sesudah paid / processing / hold / queued)
        if (["processing", "paid", "lunas", "queued", "hold", "processing-orders"].includes(status)) return "diproses";
        if (["paid", "lunas"].includes(payment)) return "diproses";

        // fallback: kalau belum jelas, anggap menunggu pembayaran (lebih aman secara UX)
        return "menunggu_pembayaran";
      })();

      const stepMessage = (() => {
        const baseNote = [
          "**Data login akun jangan dikirim di channel publik.**",
          "Kirim hanya lewat ticket / chat admin resmi HYPERINDO.",
        ].join("\n");

        if (state === "dibatalkan") {
          return [
            "**Status order kamu: DIBATALKAN**",
            "",
            "Kalau kamu ingin mulai ulang:",
            "1) Klik **ORDER SEKARANG** lagi setelah baca instruksi ini",
            "2) Lanjut pilih format order",
            "3) Upload bukti bayar",
            "",
            baseNote,
          ].join("\n");
        }

        if (state === "selesai") {
          return [
            "**Status order kamu: SELESAI ✅**",
            "",
            "Terima kasih! Jika kamu butuh bantuan, pilih **Bantuan Admin**.",
            baseNote,
          ].join("\n");
        }

        if (state === "diproses") {
          return [
            "**Status order kamu: DIPROSES 🔄**",
            "",
            "Posisi sekarang: Admin/staff sedang memproses pesanan kamu.",
            "",
            "Yang bisa kamu lakukan:",
            "1) Pastikan data sudah benar di ticket",
            "2) Tunggu info berikutnya dari admin",
            "",
            baseNote,
          ].join("\n");
        }

        if (state === "revisi") {
          return [
            "**Status order kamu: REVISI 🛠️**",
            "",
            "Admin butuh perbaikan/data tambahan sebelum diproses lagi.",
            "",
            "Yang perlu kamu lakukan:",
            "1) Buka ticket order kamu",
            "2) Ikuti instruksi revisi dari staff/admin (mis. koreksi data / bukti / detail)",
            "3) Setelah revisi selesai, tunggu konfirmasi admin",
            "",
            baseNote,
          ].join("\n");
        }

        if (state === "menunggu_konfirmasi") {
          return [
            "**Status order kamu: MENUNGGU KONFIRMASI ⏳**",
            "",
            "Bukti/persyaratan kamu sudah masuk antrian pengecekan admin.",
            "",
            "Yang perlu kamu lakukan:",
            "1) Pastikan bukti bayar sudah kamu upload di **channel ticket order**",
            "2) Jika sudah, tunggu staff/admin melakukan pengecekan",
            "",
            baseNote,
          ].join("\n");
        }

        // menunggu_pembayaran
        return [
          "**Status order kamu: MENUNGGU PEMBAYARAN 💳**",
          "",
          "Langkah order step-by-step:",
          "1) Klik **FORMAT** (pilih layanan/format order yang sesuai)",
          "2) Setelah format tersimpan, upload **bukti bayar** di ticket ini",
          "3) Tunggu staff/admin konfirmasi payment",
          "",
          baseNote,
        ].join("\n");
      })();

      const ticketOpen = await services.orderService.openOrder(interaction, "Order dari ORDER SEKARANG");
      const channel = ticketOpen?.channel;
      const reused = ticketOpen?.reused;
      const ticketId = ticketOpen?.ticket?.id || null;
      const channelLabel = resolveTicketChannelLabel(channel, ticketId);

      await interaction.editReply(
        reused
          ? `${stepMessage}\n\n(Info) Ticket order aktif di ${channelLabel}.`
          : `${stepMessage}\n\n(Info) Saya buat ticket order untuk kamu: ${channelLabel}.`,
      );
      return null;
    }

    // legacy: /ticket:order
    const { channel, reused } = await services.orderService.openOrder(interaction, "Order dari panel ORDER");
    const channelLabel = resolveTicketChannelLabel(channel);
    await interaction.editReply(
      reused
        ? `Kamu masih punya order aktif di ${channelLabel}. Lanjut **FORMAT** lalu **UPLOAD BUKTI BAYAR**.`
        : `Order ticket berhasil dibuat di ${channelLabel}. Lanjut **FORMAT** lalu **UPLOAD BUKTI BAYAR**.`,
    );
    return null;
  }

  // Customer Simple Mode: Cek Pesanan
  if (interaction.customId === componentIds.customerSimpleCheckButton) {
    if (!(await requireVerifiedMember(interaction))) return null;
    if (!(await ensureTermsAcceptedForCustomer())) return null;

    const { MessageFlags } = require("discord.js");
    const { createOrderStatusSelectRow } = require("../components/selects/orderStatusSelect");
    await safeReply(interaction, {
      content: "Pilih status order kamu:",
      components: [createOrderStatusSelectRow()],
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
    return null;
  }

  // Customer Simple Mode: Pembayaran
  if (interaction.customId === componentIds.customerSimplePaymentButton) {
    if (!(await requireVerifiedMember(interaction))) return null;
    if (!(await ensureTermsAcceptedForCustomer())) return null;

    const { MessageFlags } = require("discord.js");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await services.paymentService.sendPaymentPanel(interaction.channel).catch(() => null);
    await interaction.editReply("Panel pembayaran sudah dikirim. Untuk upload bukti bayar, gunakan ticket order ya.");
    return null;
  }

  // Customer Simple Mode: Bantuan Admin (entry menu)
  if (interaction.customId === componentIds.customerSimpleAdminHelpButton) {
    if (!(await requireVerifiedMember(interaction))) return null;
    if (!(await ensureTermsAcceptedForCustomer())) return null;

    const { MessageFlags } = require("discord.js");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const type = "support";
    const { channel, reused } = await services.ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      type,
      { detail: `Ticket support dari Customer Simple Mode (${interaction.user.id})` },
    );

    await interaction.editReply(
      reused ? `Kamu masih punya ticket aktif: ${channel}` : `Ticket bantuan dibuat: ${channel}`,
    );
    return null;
  }

  // Customer Simple Mode: navigator (global dalam ticket order)
  if (interaction.customId === componentIds.customerNavAdminHelpButton) {
    if (!(await requireVerifiedMember(interaction))) return null;

    const { MessageFlags } = require("discord.js");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const type = "support";
    const { channel, reused } = await services.ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      type,
      { detail: `Bantuan admin (navigator) untuk order ticket - request by ${interaction.user.id}` },
    );

    await interaction.editReply(
      reused ? `Kamu masih punya ticket aktif: ${channel}` : `Ticket bantuan dibuat: ${channel}`,
    );
    return null;
  }

  if (interaction.customId === componentIds.customerNavRepeatButton || interaction.customId === componentIds.customerNavBackButton) {
    if (!(await requireVerifiedMember(interaction))) return null;

    const { MessageFlags } = require("discord.js");

    const ticket = await repositories.ticketRepository?.findByChannelId?.(interaction.channel.id).catch(() => null);
    if (!ticket || ticket.type !== "order") {
      return safeReply(interaction, {
        content: "Navigator hanya tersedia di ticket order kamu.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }

    const hasOrderFormat = Boolean(ticket.meta?.formType);

    const flowText = [
      "**FLOW ORDER (Customer Simple Mode)**",
      hasOrderFormat ? "1) Format order kamu sudah tersimpan" : "1) Pilih format order sesuai layanan kamu",
      hasOrderFormat ? "2) Upload screenshot/foto bukti transfer di ticket ini" : "2) Isi data order lewat tombol format",
      hasOrderFormat ? "3) Setelah payment valid, order masuk proses admin" : "3) Upload screenshot/foto bukti transfer di ticket ini",
      hasOrderFormat ? "" : "4) Setelah payment valid, order masuk proses admin",
      "",
      "**NOTE**",
      "Data login akun jangan dikirim di channel publik.",
      "Kirim data login hanya melalui ticket / chat admin resmi HYPERINDO.",
    ]
      .filter(Boolean)
      .join("\n");

    await safeReply(interaction, {
      content: flowText,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);

    return null;
  }

  const showAdminPanel = async () => {
    const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
    const { isOwnerOrStaff } = require("../utils/permissionCheck");

    if (!isOwnerOrStaff(interaction.member)) {
      return safeReply(interaction, { content: "Akses admin saja.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const embed = new EmbedBuilder()
      .setTitle("⚙️ ADMIN PANEL")
      .setDescription("Pilih menu admin. (Admin tidak bergantung slash command—button/select/modal semua.)")
      .setColor(0x57f287)
      .setFooter({ text: "HYPEBOTX" });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(componentIds.adminNavOrdersButton).setLabel("📦 Orders").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentIds.adminNavTicketsButton).setLabel("🎫 Tickets").setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(componentIds.adminNavPaymentsButton).setLabel("💳 Payments").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentIds.adminNavStaffButton).setLabel("👥 Staff").setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(componentIds.adminNavPromoButton).setLabel("📢 Promo").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentIds.adminNavChatbotButton).setLabel("🤖 Chatbot").setStyle(ButtonStyle.Secondary),
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(componentIds.adminNavAnalyticsButton).setLabel("📊 Analytics").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentIds.adminNavSettingsButton).setLabel("🛠 Settings").setStyle(ButtonStyle.Secondary),
    );

    const row5 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(componentIds.setupWizardButton).setLabel("🧭 Setup Wizard").setStyle(ButtonStyle.Success),
    );

    return safeReply(interaction, {
      embeds: [embed],
      components: [row1, row2, row3, row4, row5],
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  };

  // ⚙️ ADMIN PANEL (button-first)
  if (interaction.customId === componentIds.adminPanelButton) {
    try {
      services.loggingService?.logAdminAction?.(
        interaction.guild,
        "Admin Panel Open",
        `Admin ${interaction.user.tag} membuka Admin Panel.`,
        [
          { name: "Actor", value: interaction.user.tag, inline: true },
          { name: "User ID", value: interaction.user.id, inline: true },
        ],
      );
    } catch { /* best-effort */ }
    return showAdminPanel();
  }

  // 🧭 SETUP WIZARD (button-first)
  if (interaction.customId === componentIds.setupWizardButton) {
    const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require("discord.js");

    const { isOwnerOrStaff } = require("../utils/permissionCheck");
    if (!isOwnerOrStaff(interaction.member)) {
      return safeReply(interaction, { content: "Akses admin saja.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    // admin action tracking
    services.loggingService?.logAdminAction?.(
      interaction.guild,
      "Setup Wizard Open",
      `Admin ${interaction.user.tag} membuka Setup Wizard.`,
      [
        { name: "Actor", value: interaction.user.tag, inline: true },
        { name: "User ID", value: interaction.user.id, inline: true },
      ],
    ).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle("🧭 Setup Wizard")
      .setDescription("Pilih mode setup, lalu klik **Mulai Setup**.")
      .setColor(0x57f287)
      .setFooter({ text: "HYPEBOTX" });

    const select = new StringSelectMenuBuilder()
      .setCustomId(componentIds.setupModeSelect)
      .setPlaceholder("Pilih mode setup...")
      .addOptions([
        { label: "basic", value: "basic", description: "Template basic / community ringan" },
        { label: "community", value: "community", description: "Template community" },
        { label: "gamestore", value: "gamestore", description: "Full GameStore + panel" },
        { label: "roles", value: "roles", description: "Sinkronkan role final" },
      ]);

    const row = new ActionRowBuilder().addComponents(select);

    // add quick back button
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(componentIds.adminPanelButton)
        .setLabel("⬅️ Kembali ke Admin Panel")
        .setStyle(ButtonStyle.Secondary),
    );

    return safeReply(interaction, {
      embeds: [embed],
      components: [row, backRow],
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  }

  if (interaction.customId === componentIds.setupBackToAdminPanelButton) {
    return showAdminPanel();
  }

  if (interaction.customId.startsWith(`${componentIds.setupConfirmButton}:`)) {
    const { MessageFlags } = require("discord.js");
    const mode = interaction.customId.split(":").slice(2).join(":");
    const { isOwnerOrStaff } = require("../utils/permissionCheck");

    if (!isOwnerOrStaff(interaction.member)) {
      return safeReply(interaction, { content: "Akses admin saja.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // admin action tracking: setup confirmed/executed
    try {
      services.loggingService?.logAdminAction?.(
        interaction.guild,
        "Setup Wizard Confirm",
        `Admin ${interaction.user.tag} menjalankan setup mode=\`${mode}\`.`,
        [
          { name: "Actor", value: interaction.user.tag, inline: true },
          { name: "User ID", value: interaction.user.id, inline: true },
          { name: "Mode", value: String(mode), inline: true },
        ],
      );
    } catch { /* best-effort */ }

    const services = client.container.services;

    try {
      if (mode === "roles") {
        const summary = await services.roleService.ensureRoles(interaction.guild);
        return interaction.editReply(`✅ Setup roles selesai.\nDibuat: ${summary.created.length}\nDiupdate: ${summary.updated.length}\nGagal: ${summary.failed?.length || 0}`);
      }

      const summary = await services.structureService.ensureTemplate(interaction.guild, mode);

      if (mode === "gamestore") {
        // kirim panel default
        const { normalizeTextChannelName } = require("../utils/normalizeName");

        const guild = interaction.guild;
        function findTextChannel(normalizedName) {
          return guild.channels.cache.find(
            (channel) => normalizeTextChannelName(channel.name) === normalizedName && channel.isTextBased?.(),
          );
        }

        const verifyChannel = findTextChannel("verify");
        const roleChannel = findTextChannel("choose-role") || findTextChannel("role-select");
        const ticketChannel = findTextChannel("open-ticket");
        const paymentChannel = findTextChannel("payment-method") || findTextChannel("payment-info");
        const promoChannel = findTextChannel("promo");

        if (verifyChannel) await services.verifyService.sendVerifyPanel(verifyChannel);
        if (roleChannel) await services.verifyService.sendRolePanel(roleChannel);
        if (ticketChannel) await services.ticketService.sendTicketPanel(ticketChannel);
        if (paymentChannel) await services.paymentService.sendPaymentPanel(paymentChannel);
        if (promoChannel) await services.paymentService.sendPromoPanel(promoChannel);
      }

      return interaction.editReply(`✅ Setup \`${mode}\` selesai.\nKategori: ${summary.categories}\nChannel: ${summary.channels}`);
    } catch (e) {
      return interaction.editReply({ content: `❌ Setup gagal: ${e?.message || String(e)}` }).catch(() => null);
    }
  }

  if (interaction.customId === componentIds.adminNavAnalyticsButton) {
    const { MessageFlags } = require("discord.js");
    const { isOwnerOrStaff } = require("../utils/permissionCheck");

    if (!isOwnerOrStaff(interaction.member)) {
      return safeReply(interaction, { content: "Akses admin saja.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    try {
      const analytics = client.container.services?.analyticsService;
      const guildId = interaction.guild?.id;

      const result = await analytics?.getAnalyticsForGuild?.(guildId).catch((e) => null);
      if (!result?.ok) {
        return safeReply(interaction, {
          content: "Gagal memuat analytics saat ini.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }

      const embed = analytics.buildAnalyticsEmbed({
        analytics: result,
        guildName: interaction.guild?.name || "HYPEBOTX",
      });

      // Best-effort admin action log
      services?.loggingService?.logAdminAction?.(
        interaction.guild,
        "Analytics Open",
        `Admin ${interaction.user.tag} membuka Analytics.`,
        [
          { name: "Actor", value: interaction.user.tag, inline: true },
          { name: "User ID", value: interaction.user.id, inline: true },
        ],
      ).catch(() => null);

      return safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => null);
    } catch {
      return safeReply(interaction, {
        content: "Terjadi error saat memuat analytics.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  }

  if ([
    componentIds.adminNavOrdersButton,
    componentIds.adminNavTicketsButton,
    componentIds.adminNavPaymentsButton,
    componentIds.adminNavStaffButton,
    componentIds.adminNavPromoButton,
    componentIds.adminNavChatbotButton,
    componentIds.adminNavAnalyticsButton,
    componentIds.adminNavSettingsButton,
  ].includes(interaction.customId)) {
    const { MessageFlags } = require("discord.js");
    const { isOwnerOrStaff } = require("../utils/permissionCheck");

    if (!isOwnerOrStaff(interaction.member)) {
      services?.loggingService?.logSecurity?.(
        interaction.guild,
        "Unauthorized Button Usage",
        `Non-admin attempted to open admin nav via customId=${interaction.customId}`,
        [
          { name: "Actor", value: interaction.user.tag, inline: true },
          { name: "User ID", value: interaction.user.id, inline: true },
          { name: "CustomID", value: interaction.customId, inline: false },
        ],
      ).catch(() => null);

      return safeReply(interaction, { content: "Akses admin saja.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const label = (() => {
      switch (interaction.customId) {
        case componentIds.adminNavOrdersButton: return "Orders";
        case componentIds.adminNavTicketsButton: return "Tickets";
        case componentIds.adminNavPaymentsButton: return "Payments";
        case componentIds.adminNavStaffButton: return "Staff";
        case componentIds.adminNavPromoButton: return "Promo";
        case componentIds.adminNavChatbotButton: return "Chatbot";
        case componentIds.adminNavSettingsButton: return "Settings";
        default: return "Menu admin";
      }
    })();

    return safeReply(interaction, {
      content: `✅ ${label} panel masuk dulu.\n\nDetail fungsi (list/detail/edit) akan menyusul setelah routing stabil.`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  }

  if (interaction.customId === componentIds.paymentProofButton) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    // Defensive: beberapa environment pernah melempar ReferenceError MessageFlags.
    // Import ulang di-scope blok ini agar tidak bergantung pada import file-level.
    const { MessageFlags } = require("discord.js");

    const relatedTicket = await client.container.repositories.ticketRepository?.findByChannelId?.(interaction.channel.id);

    if (!relatedTicket || relatedTicket.type !== "order") {
      return safeReply(interaction, {
        content: "Bukti transfer hanya dikirim setelah ticket order dibuat. Buka ticket order dulu, lalu upload gambar bukti transfer di channel ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return safeReply(interaction, {
      content: "Silakan upload screenshot/foto bukti transfer langsung di channel ticket ini. Tidak perlu isi form.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // SPRINT 1: Payment/Warranty decision buttons
  if (interaction.customId.startsWith(componentIds.paymentApprovePrefix)) {
    const suffix = interaction.customId.slice(componentIds.paymentApprovePrefix.length);
    const ticketId = suffix;

    const { isOwnerOrStaff } = require("../utils/permissionCheck");
    if (!isOwnerOrStaff(interaction.member)) {
      const { MessageFlags } = require("discord.js");
      return safeReply(interaction, { content: "Hanya staff/admin yang bisa approve payment.", flags: MessageFlags.Ephemeral }).catch((error) => client.container.logger?.warn?.("Failed to reply approval denial", { error: error?.message ?? String(error), interactionId: interaction?.id, userId: interaction?.user?.id, channelId: interaction?.channel?.id }));
    }

    // Resolve ticket by channelId (authoritative) and ensure it is order ticket
    const relatedTicket = await client.container.repositories.ticketRepository?.findByChannelId?.(interaction.channel.id);
    if (!relatedTicket || relatedTicket.type !== "order") return null;

    // pembayaran approve: saya jalankan lewat service baru nanti (belum ditulis di repo)
    if (!client.container.services?.paymentService?.approvePaymentFromTicketId) return null;

    return client.container.services.paymentService.approvePaymentFromTicketId(interaction, relatedTicket, ticketId);
  }

  if (interaction.customId.startsWith(componentIds.paymentRejectPrefix)) {
    const suffix = interaction.customId.slice(componentIds.paymentRejectPrefix.length);
    const ticketId = suffix;

    const { isOwnerOrStaff } = require("../utils/permissionCheck");
    if (!isOwnerOrStaff(interaction.member)) {
      const { MessageFlags } = require("discord.js");
      return safeReply(interaction, { content: "Hanya staff/admin yang bisa reject payment.", flags: MessageFlags.Ephemeral }).catch((error) => client.container.logger?.warn?.("Failed to reply reject denial", { error: error?.message ?? String(error), interactionId: interaction?.id, userId: interaction?.user?.id, channelId: interaction?.channel?.id }));
    }

    const relatedTicket = await client.container.repositories.ticketRepository?.findByChannelId?.(interaction.channel.id);
    if (!relatedTicket || relatedTicket.type !== "order") return null;

    return interaction.showModal(createPaymentRejectReasonModal(ticketId));
  }

  if (interaction.customId.startsWith(componentIds.warrantyAcceptPrefix)) {
    const suffix = interaction.customId.slice(componentIds.warrantyAcceptPrefix.length);
    const ticketId = suffix;

    const { isOwnerOrStaff } = require("../utils/permissionCheck");
    if (!isOwnerOrStaff(interaction.member)) {
      const { MessageFlags } = require("discord.js");
      return safeReply(interaction, { content: "Hanya staff/admin yang bisa accept warranty.", flags: MessageFlags.Ephemeral }).catch((error) => client.container.logger?.warn?.("Failed to reply accept warranty denial", { error: error?.message ?? String(error), interactionId: interaction?.id, userId: interaction?.user?.id, channelId: interaction?.channel?.id }));
    }

    const relatedTicket = await client.container.repositories.ticketRepository?.findByChannelId?.(interaction.channel.id);
    if (!relatedTicket || relatedTicket.type !== "warranty") return null;

    if (!client.container.services?.ticketService?.setWarrantyDecision) return null;

    return client.container.services.ticketService.setWarrantyDecision(interaction, relatedTicket, {
      status: "accepted",
      reason: null,
    });
  }

  if (interaction.customId.startsWith(componentIds.warrantyRejectPrefix)) {
    const suffix = interaction.customId.slice(componentIds.warrantyRejectPrefix.length);
    const ticketId = suffix;

    const { isOwnerOrStaff } = require("../utils/permissionCheck");
    if (!isOwnerOrStaff(interaction.member)) {
      const { MessageFlags } = require("discord.js");
      return safeReply(interaction, { content: "Hanya staff/admin yang bisa reject warranty.", flags: MessageFlags.Ephemeral }).catch((error) => client.container.logger?.warn?.("Failed to reply reject warranty denial", { error: error?.message ?? String(error), interactionId: interaction?.id, userId: interaction?.user?.id, channelId: interaction?.channel?.id }));
    }

    const relatedTicket = await client.container.repositories.ticketRepository?.findByChannelId?.(interaction.channel.id);
    if (!relatedTicket || relatedTicket.type !== "warranty") return null;

    if (!client.container.services?.ticketService?.setWarrantyDecision) return null;

    return client.container.services.ticketService.setWarrantyDecision(interaction, relatedTicket, {
      status: "rejected",
      reason: null,
    });
  }

  if (interaction.customId.startsWith(componentIds.warrantyNeedProofPrefix)) {
    const suffix = interaction.customId.slice(componentIds.warrantyNeedProofPrefix.length);
    const ticketId = suffix;

    const { isOwnerOrStaff } = require("../utils/permissionCheck");
    if (!isOwnerOrStaff(interaction.member)) {
      const { MessageFlags } = require("discord.js");
      return safeReply(interaction, { content: "Hanya staff/admin yang bisa set need more proof warranty.", flags: MessageFlags.Ephemeral }).catch((error) => client.container.logger?.warn?.("Failed to reply warranty proof denial", { error: error?.message ?? String(error), interactionId: interaction?.id, userId: interaction?.user?.id, channelId: interaction?.channel?.id }));
    }

    const relatedTicket = await client.container.repositories.ticketRepository?.findByChannelId?.(interaction.channel.id);
    if (!relatedTicket || relatedTicket.type !== "warranty") return null;

    return interaction.showModal(createWarrantyNeedProofReasonModal(ticketId));
  }

  if (interaction.customId === componentIds.orderFormButton) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }
    if (!(await ensureTermsAcceptedForCustomer())) {
      return null;
    }

    return interaction.showModal(createOrderFormModal());
  }

  if (interaction.customId === componentIds.topupFormButton) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }
    if (!(await ensureTermsAcceptedForCustomer())) {
      return null;
    }

    return interaction.showModal(createTopupFormModal());
  }

  if (interaction.customId === componentIds.warrantyButton) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }
    if (!(await ensureTermsAcceptedForCustomer())) {
      return null;
    }

    return interaction.showModal(createWarrantyModal());
  }

  const formatModalFactory = formatModalFactories[interaction.customId];
  if (formatModalFactory) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }
    if (!(await ensureTermsAcceptedForCustomer())) {
      return null;
    }

    return interaction.showModal(formatModalFactory());
  }

  const formatType = getFormatTypeFromButtonId(interaction.customId);
  if (formatType) {
    return safeReply(interaction, {
      embeds: [createOrderFormatEmbed(formatType)],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.customId.startsWith(componentIds.giveawayJoinPrefix)) {
    const giveawayId = interaction.customId.slice(componentIds.giveawayJoinPrefix.length);
    return services.funService.joinGiveaway(interaction, giveawayId);
  }

  if (
    [
      componentIds.quickActionSummary,
      componentIds.quickActionInvoice,
      componentIds.quickActionMarkPaid,
      componentIds.quickActionMarkProcessing,
      componentIds.quickActionMarkCompleted,
      componentIds.quickActionCloseTicket,
    ].includes(interaction.customId)
  ) {
    return services?.backlogService?.handleQuickActionButton?.(interaction, interaction.customId);
  }

  if (interaction.customId === componentIds.testimoniButton) {
    return interaction.showModal(createTestimoniModal());
  }

  return null;
}

module.exports = {
  handleButton,
};
