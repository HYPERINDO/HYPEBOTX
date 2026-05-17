const { ChannelType, MessageFlags, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { createEmbed } = require("../utils/embed");
const { normalizeTextChannelName } = require("../utils/normalizeName");
const { hasJokiCrewAccess } = require("../utils/permissionCheck");
const { componentIds } = require("../utils/constants");
const { getCalendarDateInTimeZone } = require("../utils/time");

function createJokiService({ botConfig, logger, repositories, loggingService, statusSyncService }) {
  const DEFAULT_SECONDS_PER_ORDER = 20 * 60;

  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
  }

  async function findQueueListChannel(guild) {
    if (!guild?.channels) return null;

    const configuredId = process.env.JOKI_QUEUE_CHANNEL_ID || "";
    if (configuredId) {
      const byId = guild.channels.cache.get(configuredId) ||
        (await guild.channels.fetch(configuredId).catch((error) => {
          logBestEffort("queue channel fetch by id", { guildId: guild.id, channelId: configuredId }, error);
          return null;
        }));
      if (byId?.isTextBased?.()) return byId;
    }

    await guild.channels.fetch().catch((error) => {
      logBestEffort("queue channel fetch all", { guildId: guild.id }, error);
    });
    return guild.channels.cache.find((channel) =>
      channel.type === ChannelType.GuildText &&
      normalizeTextChannelName(channel.name).endsWith("queue-list")
    ) || null;
  }

  async function startQueue(interaction, {
    estimatedSeconds = DEFAULT_SECONDS_PER_ORDER,
    ticketId = null,
    publishAction = "manual-add",
  } = {}) {
    if (!repositories?.jokiRepository) {
      throw new Error("jokiRepository belum tersedia");
    }

    const guildId = interaction.guild.id;
    const openerId = interaction.user.id;

    await repositories.jokiRepository.ensureQueue(guildId);

    // Prevent duplicate active queue entry for the same ticket.
    if (ticketId) {
      const currentQueue = await repositories.jokiRepository.getQueue(guildId);
      const existing = currentQueue?.orders?.find(
        (order) => order.ticketId === ticketId && ["queued", "processing"].includes(order.status),
      );
      if (existing) {
        return { entry: existing, reused: true };
      }
    }

    const entry = await repositories.jokiRepository.addToQueue(guildId, {
      userId: openerId,
      ticketId,
      estimatedSeconds: Number(estimatedSeconds) || DEFAULT_SECONDS_PER_ORDER,
    });

    await repositories.jokiRepository.ensureActive(guildId);
    await repositories.jokiRepository.recalcProgressAndEta(guildId);

    const currentOrder = await repositories.jokiRepository.getOrderById(guildId, entry.id).catch((error) => {
      logBestEffort("queue order fetch after start", { guildId, orderId: entry.id }, error);
      return null;
    });
    if (ticketId && statusSyncService?.syncTicketOrderQueueStatus) {
      const syncResult = await statusSyncService.syncTicketOrderQueueStatus({
        guildId,
        ticketId,
        queueId: entry.id,
        status: currentOrder?.status || "queued",
        actorId: openerId,
        note: "Auto queue started",
        repositories,
      }).catch((error) => {
        logger?.error?.("joki start status sync failed", {
          guildId,
          ticketId,
          queueId: entry.id,
          message: error.message,
        });
        return null;
      });
      if (syncResult && !syncResult.ok) {
        logger?.warn?.("joki start status sync partial failure", {
          guildId,
          ticketId,
          queueId: entry.id,
          errors: syncResult.errors,
        });
      }
    }

    logger?.info?.("joki queue started", { guildId, entryId: entry.id });
    await publishQueueUpdate(interaction.guild, entry, publishAction);
    return { entry, reused: false };
  }

  async function getQueueView(guild) {
    const queue = await repositories.jokiRepository.getQueue(guild.id);
    if (!queue) {
      return { active: null, entries: [], etaAt: null };
    }

    const active = queue.orders.find((order) => order.status === "processing") || null;
    const entries = queue.orders
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    return { active, entries, etaAt: active?.etaAt || null };
  }

  async function getQueueSummary(guild) {
    const view = await getQueueView(guild);
    if (!view) {
      return {
        available: false,
        mode: "UNKNOWN",
        status: "UNKNOWN",
        jam: null,
        updatedAt: new Date().toISOString(),
        items: [],
      };
    }

    const items = (view.entries || []).slice(0, 20).map((order, idx) => ({
      no: order.position != null ? order.position : idx + 1,
      name: order.orderLabel || order.ticketId || `order-${order.id}`,
      status: order.status || "unknown",
    }));

    return {
      available: items.length > 0,
      mode: view.active?.orderLabel?.toUpperCase().includes("ENHANCED") ? "ENHANCED" : "LEGACY",
      status: view.active ? "PROSES" : "ANTRIAN",
      jam: null,
      updatedAt: new Date().toISOString(),
      items,
    };
  }

  function buildQueueEmbed(storeName, queueView) {
    // Spec UAT: queue list hanya QUEUE/WORK, tanpa ETA/progress/DONE.
    // Tampilan: group by platform (LEGACY/ENHANCED).
    const active = queueView.active;
    const filtered = (queueView.entries || []).filter((order) => ["queued", "processing", "hold"].includes(order.status));

    function parseLabel(orderLabel) {
      const raw = typeof orderLabel === "string" ? orderLabel.trim() : "";
      const parts = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const first = parts[0] || "";
      const platform = first.toUpperCase().includes("LEGACY") ? "LEGACY"
        : first.toUpperCase().includes("ENHANCED") ? "ENHANCED"
          : "-";
      const content = parts.slice(1).join("\n");
      return { platform, content };
    }

    const legacyOrders = [];
    const enhancedOrders = [];

    for (const order of filtered) {
      const { platform, content } = parseLabel(order.orderLabel);
      if (platform === "LEGACY") legacyOrders.push({ order, content });
      else if (platform === "ENHANCED") enhancedOrders.push({ order, content });
      else {
        // Unknown platform: default to ENHANCED to avoid hiding data.
        enhancedOrders.push({ order, content });
      }
    }

    const legacyHeader = "🎮 LEGACY";
    const enhancedHeader = "🎮 ENHANCED";

    const legacyLines = legacyOrders.length
      ? legacyOrders.map(({ order, content }) => {
        const status = order.status === "processing" ? "WORK" : "QUEUE";
        return `\n${content}\nSTATUS: ${status}`.trim();
      })
      : ["-"];

    const enhancedLines = enhancedOrders.map(({ order, content }, idx) => {
      const status = order.status === "processing" ? "WORK" : order.status === "hold" ? "HOLD" : "QUEUE";
      const pos = idx + 1;
      const safeContent = String(content || "").replace(/^\s+/, "");
      return `#${pos} ${safeContent}\nSTATUS: ${status}`;
    });

    const lines = [
      "Antrian",
      "",
      legacyHeader,
      ...legacyLines.map((l) => (l === "-" ? "-" : l)),
      "",
      enhancedHeader,
      ...(enhancedLines.length ? enhancedLines : ["-"]),
    ].join("\n");

    function orderIdFromOrder(order) {
      // ticketId is not always the ORDER ID we want; queue entry uses internal queue id.
      // Spec in UAT expects ORDER ID from the label content we built.
      // We'll render it from the first matching line in content to keep consistent.
      const raw = typeof order?.orderLabel === "string" ? order.orderLabel : "";
      const m = raw.match(/ORDER ID:\s*([^\n]+)/i);
      return m?.[1]?.trim() || "-";
    }

    function customerFromOrder(order) {
      // orderLabel first line after platform usually contains customer name in our seed/auto-sync.
      const raw = typeof order?.orderLabel === "string" ? order.orderLabel : "";
      const parts = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      // parts[0] = 🎮 PLATFORM, parts[1] = customer name
      return parts[1] || "-";
    }

    const hasWork = Boolean(active && active.status === "processing");

    const activeBlock = (() => {
      if (!active || !hasWork) {
        return "Belum ada yang diproses.";
      }

      // Prefer mention if we have a valid staff/customer userId
      if (active.userId) {
        return `Aktif: <@${active.userId}>\nORDER ID: ${orderIdFromOrder(active)}\nSTATUS: WORK`;
      }

      // Otherwise render from orderLabel content (no <@null>)
      return `Aktif:\n${customerFromOrder(active)}\nORDER ID: ${orderIdFromOrder(active)}\nSTATUS: WORK`;
    })();

    return createEmbed({
      title: `Joki Queue - ${storeName}`,
      description: activeBlock,
      color: 0x3498db,
      fields: [{ name: " ", value: lines, inline: false }],
    });
  }

  async function updateAndGetView(guild) {
    await repositories.jokiRepository.recalcProgressAndEta(guild.id);
    return getQueueView(guild);
  }

  async function publishQueueUpdate(guild, order, action = "queue-update") {
    const channel = await findQueueListChannel(guild);
    if (!channel) {
      logger?.warn?.("queue-list channel not found", { guildId: guild?.id, orderId: order?.id });
      return null;
    }

    const view = await updateAndGetView(guild);
    const embed = buildQueueEmbed(guild.name, view);
    const contentMap = {
      "payment-accepted": `[AUTO] Payment diterima. Ticket otomatis masuk antrian joki (Order ID: \`${order.id}\`).`,
      "manual-add": `[QUEUE] Order masuk antrian joki (Order ID: \`${order.id}\`).`,
      "auto-start": `[AUTO] Order joki mulai diproses (Order ID: \`${order.id}\`).`,
      "auto-complete": `[AUTO] Order joki selesai diproses (Order ID: \`${order.id}\`).`,
    };

    return channel.send({
      content: contentMap[action] || `[QUEUE] Antrian joki diperbarui (Order ID: \`${order.id}\`).`,
      embeds: [embed],
    }).catch((error) => {
      logger?.error?.("queue-list publish failed", {
        guildId: guild.id,
        channelId: channel.id,
        orderId: order.id,
        message: error.message,
      });
      return null;
    });
  }

  async function updateTicketOrderStatus({ guild, order, orderStatus, actionLabel }) {
    if (!order?.ticketId) return;
    if (!repositories.ticketRepository?.findById) return;

    const ticket = await repositories.ticketRepository.findById(order.ticketId);
    if (!ticket) return;

    if (statusSyncService?.syncTicketOrderQueueStatus) {
      const syncResult = await statusSyncService.syncTicketOrderQueueStatus({
        guildId: guild.id,
        ticketId: ticket.id,
        queueId: order.id,
        status: orderStatus,
        actorId: null,
        note: `Joki automation ${actionLabel}`,
        repositories,
      }).catch((error) => {
        logger?.error?.("joki automation status sync failed", {
          guildId: guild.id,
          ticketId: ticket.id,
          queueId: order.id,
          status: orderStatus,
          actionLabel,
          message: error.message,
        });
        return null;
      });
      if (syncResult && !syncResult.ok) {
        logger?.warn?.("joki automation sync partial failure", {
          guildId: guild.id,
          ticketId: ticket.id,
          queueId: order.id,
          status: orderStatus,
          actionLabel,
          errors: syncResult.errors,
        });
      }
    } else {
      await repositories.ticketRepository.update(ticket.id, {
        orderStatus,
      });
      await repositories.orderRepository?.updateByTicketId?.(ticket.id, {
        status: orderStatus,
      }).catch((error) => {
        logBestEffort("fallback order status update", { guildId: guild.id, ticketId: ticket.id, status: orderStatus }, error);
      });
    }

    const channel = guild?.channels?.cache?.get(ticket.channelId) ||
      (await guild?.channels?.fetch?.(ticket.channelId).catch((error) => {
        logBestEffort("ticket channel fetch for joki update", { guildId: guild.id, channelId: ticket.channelId }, error);
        return null;
      }));

    if (channel?.isTextBased?.()) {
      const etaText = order.etaAt
        ? `<t:${Math.floor(new Date(order.etaAt).getTime() / 1000)}:R>`
        : "-";

      const content = orderStatus === "processing"
        ? `[AUTO] Ticket #${ticket.id} masuk proses joki. Estimasi selesai: ${etaText}`
        : `[AUTO] Ticket #${ticket.id} selesai diproses joki.`;

      const components = orderStatus === "completed"
        ? [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(componentIds.testimoniButton)
              .setLabel("Berikan Testimoni")
              .setStyle(1) // Primary
              .setEmoji("⭐")
          )
        ]
        : [];

      await channel.send({ content, components }).catch((error) => {
        logBestEffort("ticket channel send joki update", { guildId: guild.id, channelId: channel.id, ticketId: ticket.id }, error);
      });
    }

    await loggingService?.logOrder?.(
      guild,
      "Joki Queue Auto Update",
      `Ticket #${ticket.id} -> \`${orderStatus}\` (${actionLabel}).`,
      [{ name: "Order ID", value: order.id, inline: true }],
    ).catch((error) => {
      logBestEffort("log order joki auto update", { guildId: guild.id, ticketId: ticket.id, orderId: order.id }, error);
    });

    await publishQueueUpdate(guild, order, actionLabel);
  }

  async function completeTicketOrder({ guild, ticket, actorUser = null, mode = "done" }) {
    if (!guild || !ticket?.id) {
      return { ok: false, message: "Ticket tidak valid." };
    }

    const queue = await repositories.jokiRepository.getQueue(guild.id);
    const relatedOrder = queue?.orders?.find(
      (order) => String(order.ticketId || "") === String(ticket.id) && ["processing", "queued"].includes(order.status),
    );

    if (!relatedOrder) {
      return { ok: false, message: "Antrian joki aktif untuk ticket ini tidak ditemukan." };
    }

    const updatedQueue = await repositories.jokiRepository.setOrderStatus(guild.id, relatedOrder.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      progress: 100,
      completedBy: actorUser?.id || null,
    });
    const completedOrder = updatedQueue?.orders?.find((order) => order.id === relatedOrder.id) || relatedOrder;

    if (statusSyncService?.syncTicketOrderQueueStatus) {
      const syncResult = await statusSyncService.syncTicketOrderQueueStatus({
        guildId: guild.id,
        ticketId: ticket.id,
        queueId: completedOrder.id,
        status: "completed",
        actorId: actorUser?.id || null,
        note: `Joki completion from ${mode}`,
        repositories,
      }).catch((error) => {
        logger?.error?.("joki completion status sync failed", {
          guildId: guild.id,
          ticketId: ticket.id,
          queueId: completedOrder.id,
          mode,
          message: error.message,
        });
        return null;
      });
      if (syncResult && !syncResult.ok) {
        logger?.warn?.("joki completion sync partial failure", {
          guildId: guild.id,
          ticketId: ticket.id,
          queueId: completedOrder.id,
          errors: syncResult.errors,
        });
      }
    } else {
      await repositories.ticketRepository?.update?.(ticket.id, { orderStatus: "completed" }).catch((error) => {
        logBestEffort("fallback ticket complete status", { guildId: guild.id, ticketId: ticket.id }, error);
      });
      await repositories.orderRepository?.updateByTicketId?.(ticket.id, { status: "completed" }).catch((error) => {
        logBestEffort("fallback order complete status", { guildId: guild.id, ticketId: ticket.id }, error);
      });
    }

    await loggingService?.logOrder?.(
      guild,
      "Joki Done",
      `Ticket #${ticket.id} ditandai selesai dari ${mode === "terbang" ? "joki sudah terbang" : "joki done"}.`,
      [
        { name: "Order ID", value: completedOrder.id, inline: true },
        { name: "Staff", value: actorUser?.tag || actorUser?.id || "-", inline: true },
      ],
    ).catch((error) => {
      logBestEffort("log order joki done", { guildId: guild.id, ticketId: ticket.id, orderId: completedOrder.id }, error);
    });

    await publishQueueUpdate(guild, completedOrder, "auto-complete");

    return { ok: true, order: completedOrder };
  }

  async function runAutomationCycle(client) {
    if (!repositories?.jokiRepository?.listQueues || !repositories?.jokiRepository?.runAutomationTick) {
      return { processedGuilds: 0, started: 0, completed: 0 };
    }
    const queues = await repositories.jokiRepository.listQueues();
    let processedGuilds = 0;
    let started = 0;
    let completed = 0;

    for (const queue of queues) {
      if (!queue?.guildId) continue;

      const tick = await repositories.jokiRepository.runAutomationTick(queue.guildId);
      if (!tick) continue;

      processedGuilds += 1;
      started += tick.startedOrders.length;
      completed += tick.completedOrders.length;

      if (!tick.startedOrders.length && !tick.completedOrders.length) {
        continue;
      }

      const guild = client.guilds.cache.get(queue.guildId) ||
        (await client.guilds.fetch(queue.guildId).catch((error) => {
          logBestEffort("guild fetch for joki automation", { guildId: queue.guildId }, error);
          return null;
        }));
      if (!guild) continue;

      for (const order of tick.startedOrders) {
        await updateTicketOrderStatus({
          guild,
          order,
          orderStatus: "processing",
          actionLabel: "auto-start",
        });
      }

      for (const order of tick.completedOrders) {
        await updateTicketOrderStatus({
          guild,
          order,
          orderStatus: "completed",
          actionLabel: "auto-complete",
        });
      }
    }

    if (started || completed) {
      logger?.info?.("joki automation tick", { processedGuilds, started, completed });
    }

    return { processedGuilds, started, completed };
  }

  function resolveHoldThresholdMs() {
    const configured = Number(botConfig?.jobs?.jokiHoldReminderThresholdMs);
    if (Number.isFinite(configured) && configured > 0) return configured;
    const envValue = Number(process.env.JOKI_HOLD_REMINDER_THRESHOLD_MS);
    if (Number.isFinite(envValue) && envValue > 0) return envValue;
    return 60 * 60 * 1000;
  }

  function resolveHoldReminderCooldownMs() {
    const configured = Number(botConfig?.jobs?.jokiHoldReminderCooldownMs);
    if (Number.isFinite(configured) && configured > 0) return configured;
    const envValue = Number(process.env.JOKI_HOLD_REMINDER_COOLDOWN_MS);
    if (Number.isFinite(envValue) && envValue > 0) return envValue;
    return 45 * 60 * 1000;
  }

  function resolveMaxHoldAlertsPerSweep() {
    const configured = Number(botConfig?.jobs?.jokiHoldReminderMaxAlertsPerSweep);
    if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
    const envValue = Number(process.env.JOKI_HOLD_REMINDER_MAX_ALERTS);
    if (Number.isFinite(envValue) && envValue > 0) return Math.floor(envValue);
    return 25;
  }

  function formatRelativeUnix(isoText) {
    const ms = new Date(isoText || 0).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return "-";
    return `<t:${Math.floor(ms / 1000)}:R>`;
  }

  async function runHoldReminderCycle(client, options = {}) {
    if (!client?.guilds?.cache || !repositories?.jokiRepository?.listQueues || !repositories?.jokiRepository?.setOrderStatus) {
      return { scannedGuilds: 0, candidates: 0, reminded: 0 };
    }

    const thresholdMs = Number.isFinite(options.thresholdMs) && options.thresholdMs > 0
      ? options.thresholdMs
      : resolveHoldThresholdMs();
    const cooldownMs = Number.isFinite(options.cooldownMs) && options.cooldownMs > 0
      ? options.cooldownMs
      : resolveHoldReminderCooldownMs();
    const maxAlerts = Number.isFinite(options.maxAlerts) && options.maxAlerts > 0
      ? Math.floor(options.maxAlerts)
      : resolveMaxHoldAlertsPerSweep();

    const now = Date.now();
    const queues = await repositories.jokiRepository.listQueues();

    let scannedGuilds = 0;
    let candidates = 0;
    let reminded = 0;

    for (const queue of queues) {
      if (!queue?.guildId || !Array.isArray(queue.orders)) continue;
      scannedGuilds += 1;

      const guild = client.guilds.cache.get(queue.guildId) ||
        (await client.guilds.fetch(queue.guildId).catch((error) => {
          logBestEffort("guild fetch for hold reminder", { guildId: queue.guildId }, error);
          return null;
        }));
      if (!guild) continue;

      for (const order of queue.orders) {
        if (reminded >= maxAlerts) {
          return { scannedGuilds, candidates, reminded };
        }
        if (!order || order.status !== "hold") continue;

        const holdAtIso = order.holdAt || order.startedAt || order.createdAt;
        const holdAtMs = new Date(holdAtIso || 0).getTime();
        if (!Number.isFinite(holdAtMs) || holdAtMs <= 0) continue;
        if (now - holdAtMs < thresholdMs) continue;

        const lastReminderMs = new Date(order.lastHoldReminderAt || 0).getTime();
        if (Number.isFinite(lastReminderMs) && lastReminderMs > 0 && (now - lastReminderMs) < cooldownMs) {
          continue;
        }

        candidates += 1;

        const ticketId = order.ticketId || null;
        const ticket = ticketId && repositories.ticketRepository?.findById
          ? await repositories.ticketRepository.findById(ticketId).catch((error) => {
            logBestEffort("hold reminder find ticket", { guildId: guild.id, ticketId }, error);
            return null;
          })
          : null;

        const channel = ticket?.channelId
          ? guild.channels.cache.get(ticket.channelId) ||
          await guild.channels.fetch(ticket.channelId).catch((error) => {
            logBestEffort("hold reminder fetch ticket channel", {
              guildId: guild.id,
              ticketId,
              channelId: ticket?.channelId,
            }, error);
            return null;
          })
          : null;

        const orderIdFromLabel = parseOrderIdFromOrderLabel(order.orderLabel) || order.ticketId || order.id;
        const customerName = parseCustomerFromOrderLabel(order.orderLabel) || "-";
        const holdForText = formatRelativeUnix(holdAtIso);
        const nowIso = new Date().toISOString();

        if (channel?.isTextBased?.()) {
          await channel.send({
            content: [
              "[HOLD REMINDER] Order joki masih status HOLD terlalu lama.",
              `Order ID: \`${orderIdFromLabel}\``,
              `Customer: ${customerName}`,
              `Durasi HOLD: ${holdForText}`,
              "Mohon staff/admin follow up.",
            ].join("\n"),
          }).catch((error) => {
            logBestEffort("hold reminder send channel message", {
              guildId: guild.id,
              ticketId,
              channelId: channel.id,
              orderId: order.id,
            }, error);
          });
        }

        await loggingService?.logOrder?.(
          guild,
          "Joki HOLD Reminder",
          `Order \`${orderIdFromLabel}\` masih HOLD terlalu lama dan butuh follow-up staff/admin.`,
          [
            { name: "Queue ID", value: order.id || "-", inline: true },
            { name: "Ticket ID", value: ticketId || "-", inline: true },
            { name: "Customer", value: customerName || "-", inline: true },
            { name: "Hold Since", value: holdAtIso || "-", inline: false },
            { name: "Reminder Sent", value: nowIso, inline: false },
          ],
        ).catch((error) => {
          logBestEffort("hold reminder order log", {
            guildId: guild.id,
            queueId: order.id,
            ticketId,
          }, error);
        });

        await repositories.jokiRepository.setOrderStatus(guild.id, order.id, {
          lastHoldReminderAt: nowIso,
          holdReminderCount: Number(order.holdReminderCount || 0) + 1,
        }).catch((error) => {
          logBestEffort("persist hold reminder metadata", {
            guildId: guild.id,
            queueId: order.id,
          }, error);
        });

        reminded += 1;
      }
    }

    return { scannedGuilds, candidates, reminded };
  }

  function parseOrderIdFromOrderLabel(orderLabel) {
    const raw = typeof orderLabel === "string" ? orderLabel : "";
    const m = raw.match(/ORDER ID:\s*([^\n\r]+)/i);
    return m?.[1]?.trim() || null;
  }

  function parseCustomerFromOrderLabel(orderLabel) {
    // orderLabel format: first line = platform header, second line = customer name
    const raw = typeof orderLabel === "string" ? orderLabel : "";
    const parts = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return parts[1] || null;
  }

  function getTodayISODate() {
    return getCalendarDateInTimeZone(new Date(), "Asia/Jakarta");
  }

  function normalizeHeistDailyLimit(order) {
    const n = Number(order?.dailyLimitHeist);
    if (!Number.isFinite(n) || n < 0) return Number(process.env.JOKI_DAILY_HEIST_LIMIT ?? 10) || 10;
    return n;
  }

  function parseIntSafe(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }

  function heistStatusFromOrder(order) {
    const remaining = order?.remainingHeist;
    if (remaining === 0) return "completed";

    const dailyLimit = normalizeHeistDailyLimit(order);
    const todayDone = Number(order?.todayCompletedHeist || 0);
    if (todayDone >= dailyLimit) return "hold";

    // If not hold and not completed, it is active (WORK/QUEUE depending on staff claim/work).
    // For our queue list render, we'll map:
    //   - if order.status === processing => WORK
    //   - if order.status === queued => QUEUE
    //   - if order.status === hold => HOLD
    return null;
  }

  function heistIsActiveHold(order) {
    const remaining = order?.remainingHeist;
    if (remaining === 0) return false;
    const dailyLimit = normalizeHeistDailyLimit(order);
    const todayDone = Number(order?.todayCompletedHeist || 0);
    return todayDone >= dailyLimit;
  }

  async function processHeistProgress({ guild, actorUser, target, amount }) {
    if (!guild || !actorUser) return { ok: false, message: "Guild atau actor tidak valid." };
    if (!repositories?.jokiRepository?.getQueue || !repositories?.jokiRepository?.setOrderStatus) {
      return { ok: false, message: "jokiRepository belum tersedia." };
    }

    const queue = await repositories.jokiRepository.getQueue(guild.id);
    if (!queue?.orders) return { ok: false, message: "Antrian joki tidak ditemukan." };

    const normalizedTarget = String(target || "").trim();
    if (!normalizedTarget) return { ok: false, message: "Target tidak valid." };

    const match = queue.orders.find((order) => {
      if (!order) return false;
      const labelOrderId = parseOrderIdFromOrderLabel(order.orderLabel);
      if (labelOrderId && String(labelOrderId).toLowerCase() === normalizedTarget.toLowerCase()) return true;
      const customer = parseCustomerFromOrderLabel(order.orderLabel);
      if (customer && String(customer).toLowerCase() === normalizedTarget.toLowerCase()) return true;
      return false;
    });

    if (!match) return { ok: false, message: "Order ID tidak ditemukan di antrian aktif." };

    const delta = parseIntSafe(amount);
    if (delta === null || delta <= 0) {
      return { ok: false, message: "Jumlah progress harus > 0." };
    }

    // Reset todayCompletedHeist if progressDate is stale
    const today = getTodayISODate();
    const progressDate = match.progressDate || null;

    const todayReset = progressDate !== today;
    const todayCompletedHeist = todayReset ? 0 : Number(match.todayCompletedHeist || 0);
    const completedHeist = Number(match.completedHeist || 0);
    const totalHeist = match.totalHeist;

    if (totalHeist === null || totalHeist === undefined) {
      // If we don't know totalHeist yet, treat remainingHeist as total for now
      // per your spec (fallback for legacy/manual).
      const remainingFallback = match.remainingHeist;
      if (remainingFallback === null || remainingFallback === undefined) {
        return { ok: false, message: "Order ini bukan heist atau totalHeist belum diketahui." };
      }
    }

    const safeTotal = totalHeist ?? Number(match.remainingHeist || 0);
    const safeRemainingBefore = Number(match.remainingHeist ?? safeTotal);

    const newCompletedHeist = completedHeist + delta;
    const newTodayCompletedHeist = todayCompletedHeist + delta;

    const clampedCompletedHeist = Math.min(newCompletedHeist, safeTotal);
    const clampedTodayCompletedHeist = Math.min(newTodayCompletedHeist, safeTotal);

    const newRemainingHeist = Math.max(0, safeTotal - clampedCompletedHeist);

    const todayDoneNext = clampedTodayCompletedHeist;
    const dailyLimit = normalizeHeistDailyLimit(match);

    let nextStatus;
    if (newRemainingHeist === 0) {
      nextStatus = "completed";
    } else if (todayDoneNext >= dailyLimit) {
      nextStatus = "hold";
    } else {
      // Spec: if todayCompletedHeist < dailyLimitHeist and remainingHeist > 0 => status tetap WORK
      nextStatus = "processing";
    }

    const updatedQueue = await repositories.jokiRepository.setOrderStatus(guild.id, match.id, {
      status: nextStatus,
      totalHeist: match.totalHeist ?? safeTotal,
      completedHeist: clampedCompletedHeist,
      todayCompletedHeist: clampedTodayCompletedHeist,
      remainingHeist: newRemainingHeist,
      dailyLimitHeist: normalizeHeistDailyLimit(match),
      progressDate: today,
    });

    return { ok: true, order: updatedQueue?.orders?.find((o) => o.id === match.id) || match };
  }

  async function processManualQueueStatus({ guild, actorUser, target, action, mode = "manual" }) {
    if (!guild || !actorUser) {
      return { ok: false, message: "Guild atau actor tidak valid." };
    }
    if (!repositories?.jokiRepository?.getQueue || !repositories?.jokiRepository?.setOrderStatus) {
      return { ok: false, message: "jokiRepository belum tersedia." };
    }

    const queue = await repositories.jokiRepository.getQueue(guild.id);
    if (!queue || !Array.isArray(queue.orders)) {
      return { ok: false, message: "Antrian joki tidak ditemukan." };
    }

    const normalizedTarget = String(target || "").trim();
    if (!normalizedTarget) {
      return { ok: false, message: "Target (order id / nama customer) tidak valid." };
    }

    const match = queue.orders.find((order) => {
      if (!order) return false;

      const labelOrderId = parseOrderIdFromOrderLabel(order.orderLabel);
      if (labelOrderId && String(labelOrderId).toLowerCase() === normalizedTarget.toLowerCase()) {
        return true;
      }

      const customer = parseCustomerFromOrderLabel(order.orderLabel);
      if (customer && String(customer).toLowerCase() === normalizedTarget.toLowerCase()) {
        return true;
      }

      return false;
    });

    if (!match) {
      return { ok: false, message: "Order ID tidak ditemukan di antrian aktif." };
    }

    const isDone = action === "done";

    const nextStatus = action === "work" || action === "start" || action === "proses"
      ? "processing"
      : action === "hold"
        ? "hold"
        : isDone
          ? "completed"
          : null;

    if (!nextStatus) {
      return { ok: false, message: "Action tidak valid." };
    }

    // Heist-gating:
    // - DONE hanya jika remainingHeist === 0.
    // - Jika remainingHeist === 0 (completed), order tidak boleh dipaksa kembali ke processing/hold.
    const remaining = match?.remainingHeist;
    const remainingIsZero = remaining !== null && remaining !== undefined && Number(remaining) === 0;

    if (remainingIsZero && nextStatus !== "completed") {
      return {
        ok: false,
        message: "Order sudah selesai (DONE). Tidak bisa diubah ke WORK/HOLD tanpa recovery/admin action.",
      };
    }

    if (isDone) {
      if (remaining !== null && remaining !== undefined && Number(remaining) > 0) {
        return {
          ok: false,
          message: `Order belum bisa DONE, masih ada sisa ${remaining}x HEIST.`,
        };
      }
    }

    const updatedQueue = await repositories.jokiRepository.setOrderStatus(guild.id, match.id, {
      status: nextStatus,
      completedAt: nextStatus === "completed" ? new Date().toISOString() : undefined,
      progress: nextStatus === "completed" ? 100 : undefined,
      completedBy: nextStatus === "completed" ? actorUser.id : undefined,
      startedAt: nextStatus === "processing" ? match.startedAt || new Date().toISOString() : undefined,
    });

    const updatedOrder = updatedQueue?.orders?.find((o) => o.id === match.id) || match;

    await loggingService?.logOrder?.(
      guild,
      "Joki Manual Queue Update",
      `Manual: ${action} ${normalizedTarget} -> ${nextStatus}`,
      [
        { name: "Order ID", value: parseOrderIdFromOrderLabel(updatedOrder.orderLabel) || updatedOrder.id, inline: true },
        { name: "Actor", value: actorUser.tag || actorUser.id, inline: true },
      ],
    ).catch((error) => {
      // best-effort
      logBestEffort("logOrder joki manual update", { guildId: guild.id }, error);
    });

    return { ok: true, order: updatedOrder };
  }

  function getOrderActionsFromChat(actionWord) {
    const lowered = String(actionWord || "").toLowerCase();
    if (lowered === "work" || lowered === "start" || lowered === "proses" || lowered === "proses" || lowered === "kerja") return "work";
    if (lowered === "hold" || lowered === "tahan") return "hold";
    if (lowered === "done" || lowered === "selesai") return "done";
    return null;
  }

  async function publishManualQueueRefresh(guild, order, publishAction = "manual-add") {
    if (!order) return null;
    return publishQueueUpdate(guild, order, publishAction);
  }

  async function handleClaimButton(interaction, orderId) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!hasJokiCrewAccess(interaction.member)) {
      return interaction.editReply({ content: "[ERROR] Hanya staff/penjoki yang bisa claim order." });
    }

    const result = await repositories.jokiRepository.claimOrder(
      interaction.guild.id,
      orderId,
      interaction.user.id,
    );

    if (!result?.ok) {
      return interaction.editReply({ content: `[ERROR] ${result?.message || "Gagal claim order."}` });
    }

    const order = await repositories.jokiRepository.getOrderById(interaction.guild.id, orderId).catch((error) => {
      logBestEffort("get order after claim", { guildId: interaction.guild.id, orderId }, error);
      return null;
    });
    if (order?.ticketId && statusSyncService?.syncTicketOrderQueueStatus) {
      const syncResult = await statusSyncService.syncTicketOrderQueueStatus({
        guildId: interaction.guild.id,
        ticketId: order.ticketId,
        queueId: order.id,
        status: "processing",
        actorId: interaction.user.id,
        note: "Order claimed by staff",
        repositories,
      }).catch((error) => {
        logger?.error?.("joki claim status sync failed", {
          guildId: interaction.guild.id,
          ticketId: order.ticketId,
          queueId: order.id,
          message: error.message,
        });
        return null;
      });
      if (syncResult && !syncResult.ok) {
        logger?.warn?.("joki claim sync partial failure", {
          guildId: interaction.guild.id,
          ticketId: order.ticketId,
          queueId: order.id,
          errors: syncResult.errors,
        });
      }
    }

    await loggingService?.logOrder?.(
      interaction.guild,
      "Joki Claimed",
      `Order joki \`${orderId}\` di-claim oleh ${interaction.user.tag}.`,
      [{ name: "Order ID", value: orderId, inline: true }],
    ).catch((error) => {
      logBestEffort("log order joki claimed", { guildId: interaction.guild.id, orderId }, error);
    });

    const view = await updateAndGetView(interaction.guild);
    const embed = buildQueueEmbed(interaction.guild.name, view);

    return interaction.editReply({ content: `[OK] Order ${orderId} berhasil di-claim.`, embeds: [embed] });
  }

  async function handleStartButton(interaction, orderId) {
    return handleClaimButton(interaction, orderId);
  }

  async function handleFinishButton(interaction, orderId) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!hasJokiCrewAccess(interaction.member)) {
      return interaction.editReply({ content: "[ERROR] Hanya staff/penjoki yang bisa finish order." });
    }

    const result = await repositories.jokiRepository.completeOrder(
      interaction.guild.id,
      orderId,
      interaction.user.id,
    );

    if (!result?.ok) {
      return interaction.editReply({ content: `[ERROR] ${result?.message || "Gagal finish order."}` });
    }

    const order = await repositories.jokiRepository.getOrderById(interaction.guild.id, orderId).catch((error) => {
      logBestEffort("get order after finish", { guildId: interaction.guild.id, orderId }, error);
      return null;
    });
    if (order?.ticketId && statusSyncService?.syncTicketOrderQueueStatus) {
      const syncResult = await statusSyncService.syncTicketOrderQueueStatus({
        guildId: interaction.guild.id,
        ticketId: order.ticketId,
        queueId: order.id,
        status: "completed",
        actorId: interaction.user.id,
        note: "Order finished by staff",
        repositories,
      }).catch((error) => {
        logger?.error?.("joki finish status sync failed", {
          guildId: interaction.guild.id,
          ticketId: order.ticketId,
          queueId: order.id,
          message: error.message,
        });
        return null;
      });
      if (syncResult && !syncResult.ok) {
        logger?.warn?.("joki finish sync partial failure", {
          guildId: interaction.guild.id,
          ticketId: order.ticketId,
          queueId: order.id,
          errors: syncResult.errors,
        });
      }
    }

    await loggingService?.logOrder?.(
      interaction.guild,
      "Joki Finished",
      `Order joki \`${orderId}\` diselesaikan oleh ${interaction.user.tag}.`,
      [{ name: "Order ID", value: orderId, inline: true }],
    ).catch((error) => {
      logBestEffort("log order joki finished", { guildId: interaction.guild.id, orderId }, error);
    });

    const view = await updateAndGetView(interaction.guild);
    const embed = buildQueueEmbed(interaction.guild.name, view);

    return interaction.editReply({ content: `[OK] Order ${orderId} selesai.`, embeds: [embed] });
  }

  return {
    startQueue,
    getQueueView,
    getQueueSummary,
    buildQueueEmbed,
    updateAndGetView,
    publishQueueUpdate,
    publishManualQueueRefresh,
    completeTicketOrder,
    runAutomationCycle,
    runHoldReminderCycle,
    handleClaimButton,
    handleStartButton,
    handleFinishButton,
    processHeistProgress,
    processManualQueueStatus,
  };
}

module.exports = {
  createJokiService,
};
