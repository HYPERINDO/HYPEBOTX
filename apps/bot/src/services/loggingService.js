const channelConfig = require("../config/channels");
const { createEmbed } = require("../utils/embed");
const { normalizeTextChannelName } = require("../utils/normalizeName");
const { formatDateTimeInTimeZone } = require("../utils/time");

function createLoggingService({ client, logger }) {
  function resolveLogGuild(guild) {
    if (guild?.id) return guild;

    const preferredGuildId = String(process.env.RUNTIME_LOG_GUILD_ID || process.env.GUILD_ID || "").trim();
    if (preferredGuildId) {
      const preferred = client?.guilds?.cache?.get?.(preferredGuildId);
      if (preferred) return preferred;
    }

    const availableGuilds = client?.guilds?.cache ? [...client.guilds.cache.values()] : [];
    if (availableGuilds.length === 1) return availableGuilds[0];
    return null;
  }

  function findChannelByName(guild, channelName) {
    if (!guild?.channels?.cache || !channelName) return null;

    const direct = guild.channels.cache.find(
      (entry) => entry.name === channelName && typeof entry.send === "function",
    );
    if (direct) return direct;

    const normalizedTarget = normalizeTextChannelName(channelName);
    return guild.channels.cache.find(
      (entry) =>
        typeof entry.send === "function" &&
        normalizeTextChannelName(entry.name) === normalizedTarget,
    ) || null;
  }

  async function sendToNamedChannel(guild, channelName, payload) {
    try {
      const channel = findChannelByName(guild, channelName);

      if (!channel) return null;

      return await channel.send(payload);
    } catch (error) {
      logger?.warn?.("log send failed (best-effort)", {
        channelName,
        error: error?.message || String(error),
      });
      return null;
    }
  }

  // Anti-log-spam: rate-limit per guild+type+title signature (best-effort).
  const inMemoryLogThrottle = new Map(); // key -> lastTs
  function shouldThrottle(key, windowMs = 8000) {
    const now = Date.now();
    const prev = inMemoryLogThrottle.get(key);
    if (typeof prev === "number" && now - prev < windowMs) return true;
    inMemoryLogThrottle.set(key, now);
    return false;
  }

  async function log(guild, type, title, description, fields = [], opts = {}) {
    try {
      const channelName = channelConfig.logChannels[type] || channelConfig.logChannels.bot;
      const targetGuild = resolveLogGuild(guild);

      if (!targetGuild || !targetGuild.id) return;

      const throttleKey = `${targetGuild.id}:${type}:${String(title).slice(0, 60)}`;
      if (!opts?.bypassThrottle && shouldThrottle(throttleKey)) return;

      const embed = createEmbed({
        title,
        description,
        fields,
        color: type === "moderation" ? 0xe74c3c : 0x5865f2,
        footer: `Log ${type}`,
      });

      await sendToNamedChannel(targetGuild, channelName, { embeds: [embed] });
    } catch (error) {
      // logging harus best-effort: jangan sampai ganggu command utama
      logger?.warn?.("log() failed (best-effort)", { error: error?.message || String(error) });
    }
  }

  logger.info("logging service ready");

  async function logAlert(payload = {}) {
    if (!payload || typeof payload !== "object") return null;

    const suppressConsoleLog = Boolean(payload.suppressConsoleLog || payload.silent);
    const title = payload.message || `Alert: ${payload.type || "unknown"}`;
    const description = payload.details
      ? JSON.stringify(payload.details, null, 2).slice(0, 2000)
      : payload.message || "";
    const fields = [];

    if (payload.type) {
      fields.push({ name: "Type", value: String(payload.type), inline: true });
    }
    if (payload.severity) {
      fields.push({ name: "Severity", value: String(payload.severity), inline: true });
    }
    if (payload.details && typeof payload.details === "object") {
      for (const [key, value] of Object.entries(payload.details).slice(0, 6)) {
        fields.push({ name: String(key).slice(0, 24), value: String(value ?? "-").slice(0, 1024), inline: false });
      }
    }

    // HEALTH_CHECK should never spam full JSON into console logs.
    // Use concise line when HEALTH_LOG_FULL_DETAILS=false (default).
    const healthLogFullDetails =
      String(process.env.HEALTH_LOG_FULL_DETAILS ?? "false").toLowerCase() === "true";

    if (logger && !suppressConsoleLog) {
      if (payload.type === "HEALTH_CHECK" && !healthLogFullDetails) {
        const topSeverity = payload.severity ? String(payload.severity) : "info";
        logger.warn(`[HEALTH ALERT] ${topSeverity} ${payload.message || ""}`.trim());
      } else {
        logger.warn("[LOG ALERT]", { title, description, ...payload });
      }
    }

    return log(null, "runtime", title, description, fields, { bypassThrottle: true });
  }

  return {
    sendToNamedChannel,

    // Core logs already used across codebase
    logBot(guild, title, description, fields = []) {
      return log(guild, "bot", title, description, fields);
    },
    logTicket(guild, title, description, fields = []) {
      return log(guild, "ticket", title, description, fields);
    },
    logOrder(guild, title, description, fields = []) {
      return log(guild, "order", title, description, fields);
    },
    logPayment(guild, title, description, fields = []) {
      return log(guild, "payment", title, description, fields);
    },
    logModeration(guild, title, titleDescription, fields = []) {
      return log(guild, "moderation", title, titleDescription, fields);
    },

    // Required by spec: admin/security/runtime/error logs
    logAdminAction(guild, title, description, fields = []) {
      return log(guild, "admin", title, description, fields);
    },
    logSecurity(guild, title, description, fields = []) {
      return log(guild, "security", title, description, fields);
    },
    logRuntime(guild, title, description, fields = []) {
      return log(guild, "runtime", title, description, fields);
    },
    logError(guild, title, description, fields = []) {
      return log(guild, "error", title, description, fields);
    },
    logAlert,

    // Convenience: structured event fields helper
    logEvent(guild, type, eventTitle, payload = {}) {
      const safe = typeof payload === "object" && payload ? payload : {};
      const fields = Object.entries(safe)
        .slice(0, 8)
        .map(([k, v]) => ({
          name: String(k).slice(0, 24),
          value: String(v ?? "-").slice(0, 1024),
          inline: true,
        }));
      const eventAt = formatDateTimeInTimeZone(new Date(), {
        timeZone: process.env.APP_TIMEZONE || "Asia/Jakarta",
        label: (process.env.APP_TIMEZONE || "Asia/Jakarta") === "Asia/Jakarta" ? "WIB" : null,
      });
      return log(guild, type, eventTitle, `Event at ${eventAt}`, fields, { bypassThrottle: false });
    },
  };
}

module.exports = {
  createLoggingService,
};
