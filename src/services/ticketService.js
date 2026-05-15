const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");

const channels = require("../config/channels");
const roles = require("../config/roles");
const { createEmbed } = require("../utils/embed");
const { normalizeTextChannelName } = require("../utils/normalizeName");
const { buildTranscript } = require("../utils/transcript");
const { createClaimTicketButton } = require("../components/buttons/claimTicketButton");
const { createCloseTicketButton } = require("../components/buttons/closeTicketButton");
const { createOrderFlowActionRow } = require("../components/buttons/ticketButton");
const { componentIds } = require("../utils/constants");
const { createOrderFormatButtonRows } = require("../utils/orderFormatHelper");
const { createTicket } = require("../database/models/Ticket");
const { isOwnerOrStaff } = require("../utils/permissionCheck");
const { sanitizeText, sanitizeTopic, isValidUserId } = require("../utils/validators");

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function mergeActionRows(...rows) {
  const components = rows.flatMap((row) =>
    Array.isArray(row?.components) ? row.components : [],
  );

  if (!components.length) {
    return [];
  }

  return chunkArray(components, 5).map((chunk) =>
    new ActionRowBuilder().addComponents(...chunk),
  );
}

function createTicketService({
  botConfig,
  logger,
  database,
  repositories,
  roleService,
  loggingService,
  statusSyncService,
  getJokiService,
}) {
  const pendingCloseRequests = new Map();

  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
    return null;
  }

  function buildTicketOverwrites(guild, opener, roleMap) {
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: opener.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.UseApplicationCommands,
        ],
      },
    ];

    const supportRoles = [
      roleMap.owner,
      roleMap.admin,
      roleMap.staff,
      roleMap.itDev,
      roleMap.penjoki,
    ].filter(Boolean);

    for (const role of supportRoles) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageThreads,
          PermissionFlagsBits.UseApplicationCommands,
        ],
      });
    }

    return overwrites;
  }

  async function getNextTicketNumber() {
    const allTickets = await repositories.ticketRepository.getAll();
    const max = allTickets.reduce((currentMax, ticket) => {
      const value = Number.parseInt(String(ticket?.id || ""), 10);
      if (!Number.isFinite(value)) return currentMax;
      return Math.max(currentMax, value);
    }, 0);
    return String(max + 1).padStart(4, "0");
  }

  function normalizeCategoryName(name) {
    return normalizeTextChannelName(
      String(name || "").replace(/[^a-zA-Z0-9\s-]/g, " "),
    );
  }

  function findCategoryByName(guild, categoryName) {
    const target = normalizeCategoryName(categoryName);
    return guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        normalizeCategoryName(channel.name) === target,
    );
  }

  function findTextChannelByName(guild, channelName) {
    const target = normalizeTextChannelName(channelName);
    return guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        normalizeTextChannelName(channel.name) === target,
    ) || null;
  }

  async function fetchTicketChannel(guild, channelId) {
    return guild.channels.cache.get(channelId) ||
      guild.channels.cache.find((channel) => channel.id === channelId) ||
      await guild.channels.fetch(channelId).catch((error) => {
        const message = String(error?.message || "").toLowerCase();
        const unknownChannel = Number(error?.code) === 10003 || message.includes("unknown channel");
        if (!unknownChannel) {
          logBestEffort("ticket best-effort", null, error);
        }
        return null;
      });
  }

  function isThreadTicket(channel) {
    return Boolean(channel?.isThread?.());
  }

  async function ensureThreadMemberAccess(channel, memberId, ticketId) {
    if (!channel || !memberId || !isThreadTicket(channel)) return true;

    try {
      // In some cases old open tickets are still marked open but thread got archived/locked.
      if (channel.archived) {
        await channel.setArchived(false, "Restore open ticket access").catch(() => null);
      }
      if (channel.locked) {
        await channel.setLocked(false, "Restore open ticket access").catch(() => null);
      }
    } catch {
      // best-effort
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await channel.members.add(memberId);
        return true;
      } catch (error) {
        if (attempt === 2) {
          logger.warn("ticket thread opener add failed", {
            ticketId,
            openerId: memberId,
            message: error?.message,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    return false;
  }

  async function ensureTicketThreadParentChannel(guild) {
    if (channels.ticketThreadParentChannelId) {
      const parentById = guild.channels.cache.get(channels.ticketThreadParentChannelId) ||
        await guild.channels.fetch(channels.ticketThreadParentChannelId).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });

      if (parentById?.type === ChannelType.GuildText) {
        return parentById;
      }

      logger.warn("configured ticket thread parent channel not found or not text", {
        guildId: guild.id,
        ticketThreadParentChannelId: channels.ticketThreadParentChannelId,
      });
    }

    await guild.channels.fetch().catch((error) => {
      logBestEffort("ticket best-effort", null, error);
      return null;
    });
    const existingParent =
      findTextChannelByName(guild, "open-ticket") ||
      findTextChannelByName(guild, "order-panel");

    if (existingParent) {
      // IMPORTANT: Threads inherit permissions from the parent channel.
      // If parent doesn't grant SendMessagesInThreads/AttachFiles/etc, the thread becomes "read-only".
      try {
        const roleMap = roleService.getRoleMap(guild);

        // customer = verified member / customer roles depending on your setup
        const customerRoleIds = [
          roleMap.member?.id,
          roleMap.customer?.id,
          roleMap.vipCustomer?.id,
        ].filter(Boolean);

        // support roles (owner/admin/staff/itDev/penjoki)
        const supportRoleIds = [
          roleMap.owner?.id,
          roleMap.admin?.id,
          roleMap.staff?.id,
          roleMap.itDev?.id,
          roleMap.penjoki?.id,
        ].filter(Boolean);

        // @everyone: block viewing/sending into the parent channel (optional, but safe for ticket privacy)
        try {
          await existingParent.permissionOverwrites.edit(guild.roles.everyone.id, {
            ViewChannel: false,
            SendMessages: false,
            SendMessagesInThreads: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
          });
        } catch (e) {
          logger.warn("open-ticket overwrite for @everyone failed", { message: e?.message });
        }

        // customer roles: allow posting in threads + attachments
        for (const roleId of customerRoleIds) {
          try {
            await existingParent.permissionOverwrites.edit(roleId, {
              ViewChannel: true,
              ReadMessageHistory: true,
              SendMessagesInThreads: true,
              AttachFiles: true,
              EmbedLinks: true,
              UseApplicationCommands: true,
              CreatePublicThreads: false,
              CreatePrivateThreads: false,
              SendMessages: false,
            });
          } catch (e) {
            logger.warn("open-ticket overwrite for customer role failed", { roleId, message: e?.message });
          }
        }

        // support roles: allow chat + attachments in threads
        for (const roleId of supportRoleIds) {
          try {
            await existingParent.permissionOverwrites.edit(roleId, {
              ViewChannel: true,
              ReadMessageHistory: true,
              SendMessagesInThreads: true,
              AttachFiles: true,
              EmbedLinks: true,
              ManageThreads: true,
              ManageMessages: true,
              UseApplicationCommands: true,
              SendMessages: true,
              CreatePublicThreads: true,
              CreatePrivateThreads: true,
            });
          } catch (e) {
            logger.warn("open-ticket overwrite for support role failed", { roleId, message: e?.message });
          }
        }

        // extra: ensure ADMIN role itself is covered (user request)
        if (roleMap.admin?.id) {
          try {
            await existingParent.permissionOverwrites.edit(roleMap.admin.id, {
              ViewChannel: true,
              ReadMessageHistory: true,
              SendMessagesInThreads: true,
              AttachFiles: true,
              EmbedLinks: true,
              UseApplicationCommands: true,
            });
          } catch (e) {
            logger.warn("open-ticket overwrite for ADMIN role failed", { roleId: roleMap.admin.id, message: e?.message });
          }
        }
      } catch {
        // don't hard-fail ticket creation if permission edits fail due to hierarchy
      }

      return existingParent;
    }

    const orderCategory = findCategoryByName(guild, "ORDER CENTER");
    return guild.channels.create({
      name: "ðŸŽŸï¸ä¸¨open-ticket",
      type: ChannelType.GuildText,
      parent: orderCategory?.id || null,
      reason: "Buat parent channel untuk private ticket thread",
    });
  }

  async function ensureTicketCategory(guild) {
    if (channels.ticketCategoryId) {
      const categoryById = guild.channels.cache.get(channels.ticketCategoryId) ||
        await guild.channels.fetch(channels.ticketCategoryId).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });

      if (categoryById?.type === ChannelType.GuildCategory) {
        return categoryById;
      }

      logger.warn("configured ticket category id not found or not a category", {
        guildId: guild.id,
        ticketCategoryId: channels.ticketCategoryId,
      });
    }

    const categoryName = channels.defaultTicketCategory;
    return (
      findCategoryByName(guild, categoryName) ||
      guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        reason: "Buat kategori ticket",
      })
    );
  }

  async function ensureClosedTicketCategory(guild) {
    const categoryName = channels.closedTicketCategory;
    return (
      findCategoryByName(guild, categoryName) ||
      guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        reason: "Buat kategori closed ticket",
      })
    );
  }

  async function sendTicketBootstrapMessage(channel, ticket, opener) {
    const staffActionRow = new ActionRowBuilder().addComponents(
      createClaimTicketButton(),
      createCloseTicketButton(),
      new ButtonBuilder()
        .setCustomId(componentIds.adminPanelButton)
        .setLabel("⚙️ ADMIN PANEL")
        .setStyle(ButtonStyle.Secondary),
    );

    const isOrderTicket = ticket.type === "order";
    const isWarrantyTicket = ticket.type === "warranty";
    const hasOrderFormat = Boolean(ticket.meta?.formType);

    // SPRINT 1: decision buttons (payment approve/reject + warranty accept/reject/need more proof)
    const paymentDecisionRow = isOrderTicket
      ? new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${componentIds.paymentApprovePrefix}${ticket.id}`)
          .setLabel("Approve Payment")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${componentIds.paymentRejectPrefix}${ticket.id}`)
          .setLabel("Reject Payment")
          .setStyle(ButtonStyle.Danger),
      )
      : null;

    const warrantyDecisionRow = isWarrantyTicket
      ? new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${componentIds.warrantyAcceptPrefix}${ticket.id}`)
          .setLabel("Accept Warranty")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${componentIds.warrantyRejectPrefix}${ticket.id}`)
          .setLabel("Reject Warranty")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`${componentIds.warrantyNeedProofPrefix}${ticket.id}`)
          .setLabel("Need More Proof")
          .setStyle(ButtonStyle.Primary),
      )
      : null;

    const customerFlowText = isOrderTicket
      ? [
        "**FLOW ORDER**",
        hasOrderFormat
          ? "1. Format order kamu sudah tersimpan"
          : "1. Pilih format order sesuai layanan kamu",
        hasOrderFormat
          ? "2. Upload screenshot/foto bukti transfer di ticket ini"
          : "2. Isi data order lewat tombol format",
        hasOrderFormat
          ? "3. Setelah payment valid, order masuk proses admin"
          : "3. Upload screenshot/foto bukti transfer di ticket ini",
        hasOrderFormat ? "" : "4. Setelah payment valid, order masuk proses admin",
        "**NOTE**",
        "Data login akun jangan dikirim di channel publik.",
        "Kirim data login hanya melalui ticket / chat admin resmi HYPERINDO.",
      ].filter(Boolean).join("\n")
      : "Gunakan tombol di bawah untuk claim atau close ticket.";

    const customerOrderNavRow = isOrderTicket
      ? new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(componentIds.customerNavBackButton)
          .setLabel("⬅️ Kembali")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(componentIds.customerNavRepeatButton)
          .setLabel("🔁 Ulangi")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(componentIds.customerNavAdminHelpButton)
          .setLabel("👨‍💻 Bantuan Admin")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("ticket:customerClose")
          .setLabel("❌ Tutup Ticket")
          .setStyle(ButtonStyle.Danger),
      )
      : null;

    const customerOrderFlowRows = isOrderTicket
      ? mergeActionRows(createOrderFlowActionRow(), customerOrderNavRow)
      : [];

    const staffControlRows = isOrderTicket
      ? mergeActionRows(staffActionRow, paymentDecisionRow)
      : [staffActionRow];

    await channel.send({
      content: `${opener} ticket kamu sudah dibuat. Staff akan segera membantu.`,
      embeds: [
        createEmbed({
          title: `Ticket #${ticket.id} - ${ticket.type}`,
          description: customerFlowText,
          fields: [
            { name: "Jenis", value: ticket.type, inline: true },
            { name: "Pembuka", value: opener.user.tag, inline: true },
          ],
        }),
      ],
      components: isOrderTicket
        ? [
          ...(hasOrderFormat ? [] : createOrderFormatButtonRows()),
          ...customerOrderFlowRows,
          ...staffControlRows,
        ].filter(Boolean)
        : isWarrantyTicket
          ? [warrantyDecisionRow, staffActionRow].filter(Boolean)
          : [staffActionRow],
    });
  }

  function buildTicketDmDescription(ticket, channel, opener) {
    const lines = [
      "**Your Ticket Has Been Created!**",
      "",
      `Ticket ID: **${ticket.id}**`,
      `Type: **${ticket.type}**`,
    ];

    if (ticket.meta?.formType) {
      lines.push(`Service: **${ticket.meta.formType}**`);
    }

    lines.push(
      "",
      "**Click here to open your ticket:**",
      `${channel}`,
      "",
      `If the link doesn't work, look for the thread "${channel.name}" in the server.`,
    );

    return lines.join("\n");
  }

  async function sendTicketDmNotice(opener, ticket, channel) {
    if (!opener?.send) return;

    await opener.send({
      embeds: [
        createEmbed({
          title: "Ticket Created",
          description: buildTicketDmDescription(ticket, channel, opener),
          color: 0x57f287,
        }),
      ],
    }).catch((error) => {
      logger.warn("ticket dm notice failed", {
        ticketId: ticket.id,
        openerId: opener.id,
        message: error.message,
      });
    });
  }

  async function prepareTicketClosure(guild, channel, ticket, reason, actorLabel) {
    let transcript = "Transcript unavailable.";
    let transcriptName = `ticket-${ticket.id}-${Date.now()}.txt`;
    let transcriptPath = null;

    try {
      transcript = await buildTranscript(channel);
      transcriptPath = await database.saveTranscript(transcriptName, transcript);
    } catch (error) {
      logger.warn("ticket closure transcript failed", {
        ticketId: ticket.id,
        channelId: channel.id,
        message: error?.message || String(error),
      });
    }

    const updatedTicket = await repositories.ticketRepository.update(ticket.id, {
      status: "closed",
      closedAt: new Date().toISOString(),
      closeReason: reason,
      claimedBy: ticket.claimedBy || null,
    });

    await loggingService?.logTicket?.(
      guild,
      "Ticket Closed",
      `Ticket #${ticket.id} ditutup.`,
      [
        { name: "Alasan", value: reason, inline: false },
        { name: "Closed By", value: actorLabel, inline: true },
        { name: "Transcript", value: transcriptPath || "Unavailable", inline: false },
      ],
    );

    return {
      ticket: updatedTicket,
      transcriptName,
      transcriptPath,
    };
  }

  async function sendTicketPanel(channel) {
    const simpleMenuRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(componentIds.customerSimpleOrderButton)
        .setLabel("🛒 ORDER")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(componentIds.customerSimpleCheckButton)
        .setLabel("📦 CEK PESANAN")
        .setStyle(ButtonStyle.Secondary),
    );

    const simpleMenuRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(componentIds.customerSimplePaymentButton)
        .setLabel("💳 PEMBAYARAN")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(componentIds.customerSimpleAdminHelpButton)
        .setLabel("👨‍💻 BANTUAN ADMIN")
        .setStyle(ButtonStyle.Danger),
    );

    const payload = {
      embeds: [
        createEmbed({
          title: "🛒 ORDER MENU HYPERINDO",
          description: "Pilih menu yang kamu butuhkan. Order dibuat **step-by-step** (nggak bikin bingung).",
          color: 0x57f287,
          fields: [
            {
              name: "Langkah cepat",
              value: "1) Klik menu → 2) Ikuti instruksi di ticket → 3) Status order kamu terlihat.",
              inline: false,
            },
          ],
          footer: { text: "HYPEBOTX - Ticketing System" },
        }),
      ],
      components: [simpleMenuRow1, simpleMenuRow2, ...createOrderFormatButtonRows()],
    };

    const existingPanels = await channel.messages?.fetch?.({ limit: 25 })
      .then((messages) => messages
        .filter((message) =>
          message.author?.bot &&
          message.embeds?.some((embed) => embed.title === "FORMAT ORDER HYPERINDO"),
        )
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp))
      .catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });

    if (existingPanels?.size) {
      const [latest, ...duplicates] = [...existingPanels.values()];
      await latest.edit(payload);
      for (const duplicate of duplicates) {
        await duplicate.delete().catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      }
      return latest;
    }

    return channel.send(payload);
  }

  async function createTicketChannel(guild, opener, type, meta = {}, options = {}) {
    const { existingTicket = null, allowExisting = true } = options;

    // Validate inputs
    if (!isValidUserId(opener.id)) {
      throw new Error("Invalid opener user ID");
    }

    if (typeof type !== "string" || !type.trim()) {
      throw new Error("Ticket type is required and must be a string");
    }

    // Sanitize type input
    const sanitizedType = sanitizeText(type.trim(), 50);
    if (!sanitizedType) {
      throw new Error("Ticket type is invalid after sanitization");
    }

    if (allowExisting && !existingTicket) {
      const existing = await repositories.ticketRepository.findOpenByUser(guild.id, opener.id, sanitizedType);
      if (existing) {
        const channel = await fetchTicketChannel(guild, existing.channelId);
        if (channel) {
          if (isThreadTicket(channel)) {
            const hasAccess = await ensureThreadMemberAccess(channel, opener.id, existing.id);
            if (!hasAccess) {
              logger.warn("ticket reuse access failed, recreating channel", {
                guildId: guild.id,
                ticketId: existing.id,
                openerId: opener.id,
                channelId: existing.channelId,
              });
              return createTicketChannel(guild, opener, sanitizedType, meta, {
                existingTicket: existing,
                allowExisting: false,
              });
            }
          }

          return { ticket: existing, channel, reused: true };
        }

        return createTicketChannel(guild, opener, sanitizedType, meta, {
          existingTicket: existing,
          allowExisting: false,
        });
      }
    }

    const ticketNumber = existingTicket?.id ||
      (await repositories.ticketRepository.allocateNextId?.(guild.id)) ||
      await getNextTicketNumber();
    const roleMap = roleService.getRoleMap(guild);
    const channelName = normalizeTextChannelName(`${sanitizedType}-${ticketNumber}-${opener.user.username}`.slice(0, 90));

    // Sanitize topic to prevent injection
    const topic = sanitizeTopic(`ticket:id=${ticketNumber}|type=${sanitizedType}|owner=${opener.id}`);

    let channel;
    let ticketMeta = meta;
    if (channels.useTicketThreads) {
      const parentChannel = await ensureTicketThreadParentChannel(guild);
      const threadName = channelName;
      // Private thread inherit permission dari parent channel.
      // discord.js tidak mendukung permissionOverwrites di threads.create().
      channel = await parentChannel.threads.create({
        name: threadName,
        type: ChannelType.PrivateThread,
        autoArchiveDuration: 10080,
        invitable: false,
        reason: `Buat private thread ticket ${sanitizedType}`,
      });

      const openerThreadAccess = await ensureThreadMemberAccess(channel, opener.id, ticketNumber);

      // Defensive: pastikan thread tidak terkunci/ter-archive saat baru dibuat
      await channel.setLocked(false, "Ensure ticket thread unlocked").catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
      await channel.setArchived(false, "Ensure ticket thread unarchived").catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });

      // PrivateThread permissionOverwrites.edit() ternyata undefined di environment ini.
      // Jadi kita hanya mengandalkan: overwrites saat threads.create + members.add() (best-effort).
      // Pastikan opener benar-benar member:
      await ensureThreadMemberAccess(channel, opener.id, ticketNumber);

      // Tambahkan role support sebagai member thread (best-effort)
      const supportRoleIds = [
        roleMap.owner?.id,
        roleMap.admin?.id,
        roleMap.staff?.id,
        roleMap.itDev?.id,
        roleMap.penjoki?.id,
      ].filter(Boolean);

      for (const roleId of supportRoleIds) {
        const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
        const members = role?.members?.values ? [...role.members.values()] : [];
        for (const member of members) {
          if (!member?.id) continue;

          // Retry add: in practice this avoids transient "not accessible" / cache race issues.
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              await channel.members.add(member.id);
              break;
            } catch (e) {
              if (attempt === 1) {
                logger.warn("ticket thread add role member failed", {
                  ticketId: ticketNumber,
                  roleId,
                  memberId: member.id,
                  message: e?.message,
                });
              }
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }
      }

      if (!openerThreadAccess) {
        const failedThreadId = channel.id;
        logger.warn("ticket thread fallback to text channel", {
          guildId: guild.id,
          ticketId: ticketNumber,
          openerId: opener.id,
          threadId: failedThreadId,
        });

        const category = await ensureTicketCategory(guild);
        const fallbackChannel = await guild.channels.create({
          name: threadName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: topic,
          permissionOverwrites: buildTicketOverwrites(guild, opener, roleMap),
          reason: `Fallback ticket channel ${sanitizedType} (thread add member failed)`,
        });

        await channel.setArchived(true, "Fallback to text channel").catch(() => null);
        await channel.setLocked(true, "Fallback to text channel").catch(() => null);

        channel = fallbackChannel;
        ticketMeta = {
          ...meta,
          ticketMode: "channel-fallback",
          fallbackFromThreadId: failedThreadId,
          parentChannelId: category.id,
          topic,
        };
      } else {
        ticketMeta = {
          ...meta,
          ticketMode: "thread",
          parentChannelId: parentChannel.id,
          topic,
        };
      }
    } else {
      const category = await ensureTicketCategory(guild);
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: topic,
        permissionOverwrites: buildTicketOverwrites(guild, opener, roleMap),
        reason: `Buat ticket ${sanitizedType}`,
      });
    }

    let ticket;
    if (existingTicket) {
      ticket = await repositories.ticketRepository.update(existingTicket.id, {
        guildId: guild.id,
        channelId: channel.id,
        openerId: opener.id,
        type: sanitizedType,
        status: "open",
        claimedBy: null,
        closedAt: null,
        closeReason: null,
        reopenedAt: new Date().toISOString(),
        meta: { ...(existingTicket.meta || {}), ...ticketMeta },
      });
    } else {
      ticket = createTicket({
        id: ticketNumber,
        guildId: guild.id,
        channelId: channel.id,
        openerId: opener.id,
        type: sanitizedType,
        status: "open",
        orderStatus: "pending",
        meta: ticketMeta,
      });

      await repositories.ticketRepository.create(ticket);
    }

    await sendTicketBootstrapMessage(channel, ticket, opener);
    await sendTicketDmNotice(opener, ticket, channel);

    await loggingService.logTicket(
      guild,
      "Ticket Created",
      `Ticket #${ticket.id} dibuat.`,
      [
        { name: "User", value: opener.user.tag, inline: true },
        { name: "Jenis", value: sanitizedType, inline: true },
        { name: "Channel", value: `<#${channel.id}>`, inline: true },
      ],
    );

    logger.info("ticket created", { guildId: guild.id, ticketId: ticket.id, type: sanitizedType });
    return { ticket, channel, reused: false };
  }

  async function handleTicketSelect(interaction, type) {
    const { channel, reused } = await createTicketChannel(interaction.guild, interaction.member, type);
    await interaction.reply({
      content: reused ? `Kamu masih punya ticket aktif: ${channel}` : `Ticket berhasil dibuat: ${channel}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // SPRINT 1: Warranty decision APIs (store in ticket.meta.warrantyStatus)
  async function setWarrantyDecision(interaction, relatedTicket, { status, reason = null } = {}) {
    if (!relatedTicket || relatedTicket.type !== "warranty") return null;

    if (!isOwnerOrStaff(interaction.member)) {
      const { MessageFlags } = require("discord.js");
      await interaction.reply({ content: "Hanya staff/admin yang bisa memutuskan warranty.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return null;
    }

    const allowed = ["accepted", "rejected"];
    const safeStatus = String(status || "").toLowerCase();
    if (!allowed.includes(safeStatus)) return null;

    const decisionAt = new Date().toISOString();
    const safeReason = reason ? String(reason).trim().slice(0, 800) : null;

    await repositories.ticketRepository.update(relatedTicket.id, {
      meta: {
        ...(relatedTicket.meta || {}),
        warrantyStatus: safeStatus,
        warrantyDecisionBy: interaction.user.id,
        warrantyDecisionAt: decisionAt,
        warrantyReason: safeReason,
        source: "button",
      },
    }).catch(() => null);

    await loggingService?.logTicket?.(
      interaction.guild,
      "Warranty Decision",
      `Warranty ticket #${relatedTicket.id} diputuskan: ${safeStatus}`,
      [
        { name: "Staff", value: interaction.user.tag, inline: true },
        { name: "Decision", value: safeStatus, inline: true },
        { name: "Reason", value: safeReason || "-", inline: false },
      ],
    ).catch(() => null);

    await interaction.reply({
      content: `Warranty ${safeStatus}.`,
      flags: require("discord.js").MessageFlags.Ephemeral,
    }).catch(() => null);

    return { ok: true, status: safeStatus, reason: safeReason };
  }

  async function setWarrantyNeedProofFromModal(interaction) {
    if (!interaction?.fields) return null;

    const reason = interaction.fields.getTextInputValue("warranty_needproof_reason");
    const relatedTicket = await repositories.ticketRepository?.findByChannelId?.(interaction.channel.id);

    if (!relatedTicket || relatedTicket.type !== "warranty") {
      await interaction.reply({
        content: "Ticket warranty tidak ditemukan untuk modal ini.",
        flags: require("discord.js").MessageFlags.Ephemeral,
      }).catch(() => null);
      return null;
    }

    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({
        content: "Hanya staff/admin yang bisa memutuskan need more proof warranty.",
        flags: require("discord.js").MessageFlags.Ephemeral,
      }).catch(() => null);
      return null;
    }

    await interaction.deferReply({ flags: require("discord.js").MessageFlags.Ephemeral }).catch(() => null);

    const decisionAt = new Date().toISOString();
    const safeReason = reason ? String(reason).trim().slice(0, 800) : "-";

    await repositories.ticketRepository.update(relatedTicket.id, {
      meta: {
        ...(relatedTicket.meta || {}),
        warrantyStatus: "need_more_proof",
        warrantyDecisionBy: interaction.user.id,
        warrantyDecisionAt: decisionAt,
        warrantyReason: safeReason,
        source: "modal",
      },
    }).catch(() => null);

    await loggingService?.logTicket?.(
      interaction.guild,
      "Warranty Need More Proof",
      `Warranty ticket #${relatedTicket.id} butuh bukti tambahan.`,
      [
        { name: "Staff", value: interaction.user.tag, inline: true },
        { name: "Reason", value: safeReason, inline: false },
      ],
    ).catch(() => null);

    await interaction.editReply?.({
      content: "Warranty decision: need more proof.",
    }).catch(() => null);

    return { ok: true, status: "need_more_proof", reason: safeReason };
  }

  function cleanupPendingCloseRequests() {
    const now = Date.now();
    for (const [token, request] of pendingCloseRequests.entries()) {
      if (!request?.expiresAt || request.expiresAt <= now) {
        pendingCloseRequests.delete(token);
      }
    }
  }

  function createCloseConfirmationRow(token) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${componentIds.ticketCloseConfirmPrefix}${token}`)
        .setLabel("Confirm Close")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`${componentIds.ticketCloseCancelPrefix}${token}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  function createCloseRequestToken(ticketId, userId) {
    const random = Math.random().toString(36).slice(2, 8);
    return `${ticketId}-${userId}-${Date.now().toString(36)}-${random}`;
  }

  async function claimTicket(interaction) {
    const customId = interaction?.customId;
    const actorId = interaction?.user?.id;
    const guildId = interaction?.guild?.id;

    let isDeferred = Boolean(interaction?.deferred);
    let isReplied = Boolean(interaction?.replied);

    try {
      // MUST defer immediately to avoid "Unknown interaction" on slow handlers / double click.
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        isDeferred = true;
      }

      if (!isOwnerOrStaff(interaction.member)) {
        return interaction.editReply?.({ content: "Hanya staff yang bisa claim ticket." });
      }

      const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
      const ticketId = ticket?.id || null;

      if (!ticket) {
        return interaction.editReply?.({ content: "Channel ini bukan ticket." });
      }

      if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
        const claimedUser = `<@${ticket.claimedBy}>`;

        await loggingService?.logSecurity?.(
          interaction.guild,
          "Unauthorized Ticket Claim - Already Claimed",
          `User attempted to claim ticket #${ticket.id} but it is already claimed by another staff.`,
          [
            { name: "Actor", value: interaction.user.tag, inline: true },
            { name: "Actor ID", value: interaction.user.id, inline: true },
            { name: "Ticket ID", value: ticket.id, inline: true },
            { name: "ClaimedBy", value: ticket.claimedBy, inline: true },
          ],
        ).catch(() => null);

        return interaction.editReply?.({
          content: `Ticket ini sudah di-claim oleh ${claimedUser}.`,
        });
      }

      // Guard: if already claimed by the same user (double click), respond safely.
      if (ticket.claimedBy && ticket.claimedBy === interaction.user.id) {
        return interaction.editReply?.({ content: "Ticket sudah di-claim." });
      }

      const claimedAt = new Date().toISOString();
      const updated = await repositories.ticketRepository.update(ticket.id, {
        claimedBy: interaction.user.id,
        claimedAt,
        orderStatus: "processing",
      });

      let syncResult = null;
      if (statusSyncService?.syncTicketOrderQueueStatus) {
        syncResult = await statusSyncService.syncTicketOrderQueueStatus({
          guildId,
          ticketId: ticket.id,
          status: "processing",
          actorId: interaction.user.id,
          note: "Ticket claimed by staff",
          repositories,
        }).catch((error) => {
          logger?.error?.("ticket claim status sync failed", {
            ticketId: ticket.id,
            guildId,
            code: error?.code,
            message: error.message,
          });
          return null;
        });
      }

      // Ensure queue-list embed updates immediately after claim for joki tickets.
      if (syncResult?.queueOrderId && repositories.jokiRepository?.getOrderById) {
        const jokiService = typeof getJokiService === "function" ? getJokiService() : null;
        try {
          const queueOrder = await repositories.jokiRepository.getOrderById(guildId, syncResult.queueOrderId);
          if (jokiService?.publishQueueUpdate && queueOrder) {
            await jokiService.publishQueueUpdate(interaction.guild, queueOrder, "manual-add");
          }
        } catch (error) {
          logger?.warn?.("ticket claim queue-list refresh failed", {
            guildId,
            ticketId: ticket.id,
            queueOrderId: syncResult.queueOrderId,
            code: error?.code,
            message: error?.message || String(error),
          });
        }
      }

      await interaction.editReply?.({
        content: "Ticket berhasil di-claim.",
      });

      await loggingService.logTicket(
        interaction.guild,
        "Ticket Claimed",
        `Ticket #${ticket.id} di-claim.`,
        [
          { name: "Staff", value: interaction.user.tag, inline: true },
          { name: "Claimed At", value: claimedAt, inline: true },
        ],
      );

      return updated;
    } catch (error) {
      const code = error?.code;
      const unknownInteraction = code === 10062 || String(error?.message || "").toLowerCase().includes("unknown interaction");

      logger?.warn?.("ticket claim interaction failed", {
        customId,
        ticketId: null,
        actorId,
        guildId,
        isReplied,
        isDeferred,
        code,
        message: error?.message || String(error),
      });

      if (unknownInteraction) {
        // Requirement: don't reply/followUp on Unknown interaction to avoid spam/error logs.
        return null;
      }

      // fallback best-effort
      try {
        if (!interaction?.replied && !interaction?.deferred) {
          await interaction.reply({ content: "Gagal memproses claim ticket.", flags: MessageFlags.Ephemeral });
        } else if (interaction?.editReply) {
          await interaction.editReply({ content: "Gagal memproses claim ticket." }).catch((error) => logger?.warn?.("ticketService failed to edit reply on error recovery", { error: error?.message ?? String(error), stack: error?.stack, interactionId: interaction?.id }));
        }
      } catch (error) {
        logger?.warn?.("ticketService failed to send claim ticket error recovery reply", { error: error?.message ?? String(error), stack: error?.stack, interactionId: interaction?.id });
      }
      return null;
    }
  }

  async function requestCloseTicket(interaction, reason = "Closed by staff") {
    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    if (!ticket) {
      await interaction.reply({ content: "Channel ini bukan ticket.", flags: MessageFlags.Ephemeral });
      return null;
    }

    // BLOCKER: customer tidak boleh menutup ticket lewat tombol.
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "❌ Hanya staff/admin yang bisa menutup ticket.", flags: MessageFlags.Ephemeral });
      return null;
    }

    cleanupPendingCloseRequests();
    const token = createCloseRequestToken(ticket.id, interaction.user.id);
    pendingCloseRequests.set(token, {
      token,
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      ticketId: ticket.id,
      requestedBy: interaction.user.id,
      reason,
      createdAt: Date.now(),
      expiresAt: Date.now() + 2 * 60 * 1000,
    });

    const payload = {
      content: `Konfirmasi penutupan ticket #${ticket.id}? Alasan: \`${reason}\``,
      components: [createCloseConfirmationRow(token)],
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
    } else {
      await interaction.reply(payload).catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
    }

    return ticket;
  }

  async function handleCloseConfirmation(interaction, token, confirmed) {
    cleanupPendingCloseRequests();
    const request = pendingCloseRequests.get(token);

    if (!request) {
      await interaction.reply({
        content: "Permintaan close sudah kedaluwarsa atau tidak valid. Jalankan close lagi.",
        flags: MessageFlags.Ephemeral,
      }).catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
      return null;
    }

    if (request.guildId !== interaction.guild.id || request.channelId !== interaction.channel.id) {
      await interaction.reply({
        content: "Konfirmasi close ini bukan untuk channel ini.",
        flags: MessageFlags.Ephemeral,
      }).catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
      return null;
    }

    // BLOCKER: customer tidak boleh meng-Confirm close.
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({
        content: "❌ Hanya staff/admin yang bisa mengonfirmasi penutupan ticket.",
        flags: MessageFlags.Ephemeral,
      }).catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
      return null;
    }

    pendingCloseRequests.delete(token);

    if (!confirmed) {
      await interaction.reply({
        content: "Close ticket dibatalkan.",
        flags: MessageFlags.Ephemeral,
      }).catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
      return null;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch((error) => {
      logBestEffort("ticket best-effort", null, error);
      return null;
    });
    return closeTicket(interaction, request.reason, { skipReply: false });
  }

  async function closeTicket(interaction, reason = "Closed by staff", options = {}) {
    const ticket = options.ticketOverride || await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    if (!ticket) {
      if (interaction.deferred) {
        await interaction.editReply({ content: "Channel ini bukan ticket." }).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      } else {
        await interaction.reply({ content: "Channel ini bukan ticket.", flags: MessageFlags.Ephemeral }).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      }
      return null;
    }

    if (!options.skipPermissionCheck && !isOwnerOrStaff(interaction.member) && ticket.openerId !== interaction.user.id) {
      if (interaction.deferred) {
        await interaction.editReply({ content: "Kamu tidak punya izin menutup ticket ini." }).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      } else {
        await interaction.reply({ content: "Kamu tidak punya izin menutup ticket ini.", flags: MessageFlags.Ephemeral }).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      }
      return null;
    }

    const closure = await prepareTicketClosure(
      interaction.guild,
      interaction.channel,
      ticket,
      reason,
      interaction.user.tag,
    );

    if (!options.skipReply) {
      const closeNotice = `Ticket akan ditutup. Transcript tersimpan di \`${closure.transcriptName}\`.`;
      if (interaction.deferred) {
        await interaction.editReply({ content: closeNotice }).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      } else if (interaction.replied) {
        await interaction.followUp({ content: closeNotice, flags: MessageFlags.Ephemeral }).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      } else {
        await interaction.reply({
          content: closeNotice,
          flags: MessageFlags.Ephemeral,
        }).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      }
    }

    if (isThreadTicket(interaction.channel)) {
      await interaction.channel.setLocked(true, "Ticket ditutup").catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
      await interaction.channel.setArchived(true, "Ticket ditutup").catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });

      let activeTicketsParent =
        interaction.guild.channels.cache.find((channel) => (
          channel?.type === ChannelType.GuildText &&
          normalizeTextChannelName(channel.name).includes("active-tickets")
        )) ||
        findTextChannelByName(interaction.guild, "active-tickets") ||
        null;

      if (!activeTicketsParent) {
        activeTicketsParent = await interaction.guild.channels.fetch()
          .then((channels) => {
            for (const channel of channels.values()) {
              if (channel?.type !== ChannelType.GuildText) continue;
              if (normalizeTextChannelName(channel.name).includes("active-tickets")) {
                return channel;
              }
            }
            return null;
          })
          .catch((error) => {
            logBestEffort("ticket best-effort", null, error);
            return null;
          });
      }

      if (activeTicketsParent?.threads?.create) {
        const newThreadName = interaction.channel.name || `ticket-${ticket.id}`;
        const newThread = await activeTicketsParent.threads
          .create({
            name: newThreadName,
            type: ChannelType.PrivateThread,
            reason: "Ticket ditutup (recreate thread ke ACTIVE TICKETS)",
            autoArchiveDuration: 10080,
            invitable: false,
          })
          .catch((error) => {
            logBestEffort("ticket best-effort", null, error);
            return null;
          });

        if (newThread) {
          await newThread.members.add(ticket.openerId).catch((error) => {
            logBestEffort("ticket best-effort", null, error);
            return null;
          });
          await newThread.send({
            content: `Ticket #${ticket.id} ditutup.`,
            embeds: [
              createEmbed({
                title: `Ticket Closed - #${ticket.id}`,
                description: [
                  `Alasan: ${reason}`,
                  `Transcript tersimpan: \`${closure.transcriptName}\``,
                ].join("\n"),
                color: 0xe74c3c,
              }),
            ],
          }).catch((error) => {
            logBestEffort("ticket best-effort", null, error);
            return null;
          });

          await newThread.setLocked(true, "Ticket ditutup").catch((error) => {
            logBestEffort("ticket best-effort", null, error);
            return null;
          });
          await newThread.setArchived(true, "Ticket ditutup").catch((error) => {
            logBestEffort("ticket best-effort", null, error);
            return null;
          });
        }
      }

      await interaction.channel.delete("Ticket ditutup (hapus thread)").catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
    } else {
      const closedCategory = await ensureClosedTicketCategory(interaction.guild);
      await interaction.channel.edit({
        parent: closedCategory.id,
        reason: `Ticket ditutup dan dipindahkan ke ${closedCategory.name} (sebelum dihapus)`,
      }).catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });

      await interaction.channel.delete("Ticket ditutup (hapus channel)").catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
    }

    return closure.ticket;
  }

  async function reopenTicket(guild, ticketId, openerId) {
    // Validate inputs
    if (!ticketId || typeof ticketId !== "string") {
      throw new Error("Invalid ticket ID");
    }

    if (openerId && !isValidUserId(openerId)) {
      throw new Error("Invalid opener user ID");
    }

    const allTickets = await repositories.ticketRepository.getAll();
    const ticket = allTickets.find((entry) => entry.id === ticketId);
    if (!ticket) {
      return null;
    }

    // Verify the person reopening has permission (ticket owner or staff)
    if (openerId && openerId !== ticket.openerId) {
      const member = await guild.members.fetch(openerId).catch((error) => {
        logBestEffort("ticket best-effort", null, error);
        return null;
      });
      if (!member) {
        throw new Error("User not found in guild");
      }

      const roleMap = roleService.getRoleMap(guild);
      const isStaff = [
        roleMap.owner,
        roleMap.admin,
        roleMap.staff,
        roleMap.itDev,
        roleMap.penjoki,
      ].some((role) => role?.id && member.roles.cache.has(role.id));
      if (!isStaff) {
        throw new Error("You don't have permission to reopen this ticket");
      }
    }

    const existingChannel = await fetchTicketChannel(guild, ticket.channelId);
    if (existingChannel) {
      if (isThreadTicket(existingChannel)) {
        await existingChannel.setArchived(false, "Ticket dibuka kembali").catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
        await existingChannel.setLocked(false, "Ticket dibuka kembali").catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
        await existingChannel.members.add(ticket.openerId).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      } else {
        const ticketCategory = await ensureTicketCategory(guild);
        await existingChannel.edit({
          parent: ticketCategory.id,
          reason: "Ticket dibuka kembali dan dipindahkan ke kategori tiket aktif",
        });
      }

      const reopenedTicket = await repositories.ticketRepository.update(ticket.id, {
        status: "open",
        closedAt: null,
        closeReason: null,
        reopenedAt: new Date().toISOString(),
      });
      return { ticket: reopenedTicket, channel: existingChannel, reused: true };
    }

    const opener = await guild.members.fetch(openerId || ticket.openerId);
    if (!opener) {
      throw new Error("Original ticket opener not found in guild");
    }

    return createTicketChannel(guild, opener, ticket.type, ticket.meta || {}, {
      existingTicket: ticket,
      allowExisting: false,
    });
  }

  function parseIsoMs(value) {
    const ms = new Date(value || 0).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return ms;
  }

  function resolveInactiveWarningMs() {
    const warningHours = Number(botConfig?.jobs?.autoCloseTicket?.maxInactiveHours ?? botConfig?.jobs?.ticketInactiveWarningHours ?? botConfig?.jobs?.ticketAutoCloseHours ?? 72);
    if (!Number.isFinite(warningHours) || warningHours <= 0) return 72 * 60 * 60 * 1000;
    return warningHours * 60 * 60 * 1000;
  }

  function resolveInactiveCloseGraceMs() {
    const graceHours = Number(botConfig?.jobs?.ticketInactiveCloseGraceHours ?? 24);
    if (!Number.isFinite(graceHours) || graceHours <= 0) return 24 * 60 * 60 * 1000;
    return graceHours * 60 * 60 * 1000;
  }

  function resolvePendingPaymentGraceMs() {
    const graceHours = Number(botConfig?.jobs?.ticketPendingPaymentGraceHours ?? 6);
    if (!Number.isFinite(graceHours) || graceHours <= 0) return 6 * 60 * 60 * 1000;
    return graceHours * 60 * 60 * 1000;
  }

  function clearInactiveWarningMeta(meta = {}) {
    const next = { ...(meta || {}) };
    delete next.inactiveWarningAt;
    delete next.inactiveWarningLastActivityAt;
    delete next.inactiveWarningReason;
    delete next.inactiveWarningCloseAt;
    return next;
  }

  async function resolveAutoCloseProtection(ticket, now) {
    if (!ticket) return { blocked: false, reason: null };

    const warrantyStatus = String(ticket?.meta?.warrantyStatus || "").toLowerCase();
    if (ticket.type === "warranty" && !["accepted", "rejected"].includes(warrantyStatus)) {
      return { blocked: true, reason: "warranty_active" };
    }

    const order = await repositories.orderRepository?.findByTicketId?.(ticket.id).catch((error) => {
      logBestEffort("auto close find order", { ticketId: ticket.id, guildId: ticket.guildId }, error);
      return null;
    });

    const pendingPaymentStatuses = new Set([
      "unpaid",
      "submitted",
      "pending",
      "waiting",
      "waiting_payment",
      "waiting_payment_proof",
    ]);
    const pendingOrderStatuses = new Set([
      "pending",
      "waiting",
      "waiting_payment",
      "waiting_payment_proof",
      "queued",
    ]);

    const pendingGraceMs = resolvePendingPaymentGraceMs();
    const orderAgeMs = (() => {
      const createdAtMs = parseIsoMs(order?.createdAt || ticket?.createdAt);
      if (!createdAtMs) return null;
      return now - createdAtMs;
    })();

    const orderStatus = String(order?.status || ticket?.orderStatus || "").toLowerCase();
    const paymentStatus = String(order?.paymentStatus || "").toLowerCase();
    const activeOrderStatuses = new Set([
      "processing",
      "working",
      "delivering",
      "shipped",
      "shipping",
      "paid",
    ]);
    if (activeOrderStatuses.has(orderStatus)) {
      return { blocked: true, reason: `order_active_${orderStatus}` };
    }

    const isPendingNew =
      orderAgeMs !== null &&
      orderAgeMs < pendingGraceMs &&
      (pendingOrderStatuses.has(orderStatus) || pendingPaymentStatuses.has(paymentStatus));
    if (isPendingNew) {
      return { blocked: true, reason: "payment_pending_new" };
    }

    if (order?.id && repositories.refundDisputeRepository?.findByOrderId) {
      const disputes = await repositories.refundDisputeRepository.findByOrderId(order.id).catch((error) => {
        logBestEffort("auto close find dispute/refund", {
          ticketId: ticket.id,
          guildId: ticket.guildId,
          orderId: order.id,
        }, error);
        return [];
      });
      const hasActiveDispute = Array.isArray(disputes) &&
        disputes.some((row) => ["requested", "reviewing"].includes(String(row?.status || "").toLowerCase()));
      if (hasActiveDispute) {
        return { blocked: true, reason: "refund_dispute_active" };
      }
    }

    if (repositories.jokiRepository?.getQueue) {
      const queue = await repositories.jokiRepository.getQueue(ticket.guildId).catch((error) => {
        logBestEffort("auto close get joki queue", { ticketId: ticket.id, guildId: ticket.guildId }, error);
        return null;
      });
      const queueOrder = queue?.orders?.find((entry) =>
        String(entry?.ticketId || "") === String(ticket.id) &&
        ["processing", "hold"].includes(String(entry?.status || "").toLowerCase())
      );
      if (queueOrder) {
        return { blocked: true, reason: `joki_${String(queueOrder.status || "").toLowerCase()}` };
      }
    }

    return { blocked: false, reason: null };
  }

  async function sweepInactiveTickets(client) {
    if (!client?.isReady?.() || !client.token) {
      logger.warn("ticket auto close skipped: client is not ready");
      return;
    }

    const now = Date.now();
    const warningMs = resolveInactiveWarningMs();
    const closeGraceMs = resolveInactiveCloseGraceMs();
    const warningThreshold = now - warningMs;
    const allTickets = await repositories.ticketRepository.getAll();

    for (const ticket of allTickets) {
      if (!["open", "reopened"].includes(ticket.status)) {
        continue;
      }

      const guild =
        client.guilds.cache.get(ticket.guildId) ||
        (await client.guilds.fetch(ticket.guildId).catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        }));
      if (!guild) {
        continue;
      }

      const channel = await fetchTicketChannel(guild, ticket.channelId);

      if (!channel || !channel.isTextBased?.()) {
        await repositories.ticketRepository.update(ticket.id, {
          status: "closed",
          closedAt: new Date().toISOString(),
          closeReason: "Channel ticket hilang",
        });
        continue;
      }

      let lastActivityAt = channel.createdTimestamp;
      let latestWarningMessageId = String(ticket?.meta?.inactiveWarningMessageId || "");
      try {
        if (!channel.viewable) {
          logger.warn("ticket channel not viewable", { ticketId: ticket.id, channelId: channel.id });
          return; // Skip if not viewable
        }
        const messages = await channel.messages.fetch({ limit: 1 });
        const latest = messages.first();
        if (latest) {
          if (latestWarningMessageId && latest.id === latestWarningMessageId && latest.author?.bot) {
            const previousActivity = parseIsoMs(ticket?.meta?.inactiveWarningLastActivityAt);
            lastActivityAt = previousActivity || lastActivityAt;
          } else {
            lastActivityAt = latest.createdTimestamp;
          }
        }
      } catch (error) {
        logger.warn("ticket message fetch failed", {
          ticketId: ticket.id,
          channelId: channel.id,
          message: error.message,
        });
        // Continue without updating activity
      }

      const protection = await resolveAutoCloseProtection(ticket, now);
      if (protection.blocked) {
        if (ticket?.meta?.inactiveWarningAt) {
          await repositories.ticketRepository.update(ticket.id, {
            meta: clearInactiveWarningMeta(ticket.meta || {}),
          }).catch((error) => {
            logBestEffort("clear inactive warning after protected status", {
              ticketId: ticket.id,
              guildId: ticket.guildId,
              reason: protection.reason,
            }, error);
          });
        }
        continue;
      }

      const warningAtMs = parseIsoMs(ticket?.meta?.inactiveWarningAt);
      if (warningAtMs && lastActivityAt > warningAtMs) {
        await repositories.ticketRepository.update(ticket.id, {
          meta: clearInactiveWarningMeta(ticket.meta || {}),
        }).catch((error) => {
          logBestEffort("clear inactive warning after activity resumed", {
            ticketId: ticket.id,
            guildId: ticket.guildId,
          }, error);
        });
        continue;
      }

      if (lastActivityAt >= warningThreshold) {
        continue;
      }

      const sendWarningFirst = botConfig?.jobs?.autoCloseTicket?.sendWarningFirst !== false;

      if (!warningAtMs) {
        if (sendWarningFirst) {
          const warningNowIso = new Date().toISOString();
          const closeAt = new Date(now + closeGraceMs).toISOString();
          let warningMessage = null;
          try {
            warningMessage = await channel.send({
              content: [
                "[AUTO WARNING] Ticket ini tidak aktif terlalu lama.",
                `Jika tetap tidak ada aktivitas, ticket akan auto-close sekitar <t:${Math.floor((now + closeGraceMs) / 1000)}:R>.`,
                "Balas pesan ini untuk mempertahankan ticket tetap aktif.",
              ].join("\n"),
            });
          } catch (error) {
            logBestEffort("send inactive warning", {
              ticketId: ticket.id,
              guildId: ticket.guildId,
              channelId: channel.id,
            }, error);
          }

          await repositories.ticketRepository.update(ticket.id, {
            meta: {
              ...(ticket.meta || {}),
              inactiveWarningAt: warningNowIso,
              inactiveWarningLastActivityAt: new Date(lastActivityAt).toISOString(),
              inactiveWarningReason: `warned_then_close_after_${Math.round(closeGraceMs / (60 * 60 * 1000))}h`,
              inactiveWarningCloseAt: closeAt,
              inactiveWarningMessageId: warningMessage?.id || null,
            },
          }).catch((error) => {
            logBestEffort("persist inactive warning meta", {
              ticketId: ticket.id,
              guildId: ticket.guildId,
            }, error);
          });
          continue;
        }
      } else {
        if (now - warningAtMs < closeGraceMs) {
          continue;
        }
      }

      const closure = await prepareTicketClosure(
        guild,
        channel,
        ticket,
        "Auto closed after inactivity warning with no response",
        "Auto Close Job",
      );
      if (isThreadTicket(channel)) {
        await channel.setLocked(true, "Auto close inactive ticket").catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
        await channel.setArchived(true, "Auto close inactive ticket").catch((error) => {
          logBestEffort("ticket best-effort", null, error);
          return null;
        });
      } else {
        await channel.delete("Auto close inactive ticket");
      }
      logger.info("ticket auto closed", {
        ticketId: closure.ticket?.id || ticket.id,
        channelId: channel.id,
      });
    }
  }

  return {
    sendTicketPanel,
    createTicketChannel,
    handleTicketSelect,
    claimTicket,
    requestCloseTicket,
    handleCloseConfirmation,
    closeTicket,
    reopenTicket,
    sweepInactiveTickets,

    // SPRINT 1: warranty decision APIs
    setWarrantyDecision,
    setWarrantyNeedProofFromModal,
  };
}

module.exports = {
  createTicketService,
  mergeActionRows,
};
