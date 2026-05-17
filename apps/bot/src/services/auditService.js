const { ChannelType, PermissionFlagsBits } = require("discord.js");
const channelConfig = require("../config/channels");
const roles = require("../config/roles");
const { categoryKeywords, componentIds } = require("../utils/constants");

function createAuditService({ logger, templateService, roleService }) {
  // Normalize role/channel names - remove emojis and special chars
  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Expected category mapping for channels
  const expectedCategoryMap = {
    INFO: [
      "welcome",
      "rules",
      "announcements",
      "faq",
      "choose-role",
      "social-links",
      "verify"
    ],

    STORE: [
      "price-list",
      "promo",
      "stock-update",
      "account-showcase",
      "payment-methode",
      "payment-method",
      "payment-proof",
      "account-estalase",
      "claim-warranty"
    ],

    PRODUCTS: [
      "steam-products",
      "epic-products",
      "rockstar-products",
      "produk-steam",
      "produk-epic",
      "produk-rockstar",
      "windows-office-key",
      "key-license-win-plus-office",
      "optimizer-windows",
      "game-boosting",
      "joki-game",
      "game-top-up",
      "top-up-game",
      "account-market",
      "jual-akun",
      "account-settings",
      "setting-account",
      "produk"
    ],

    "ORDER CENTER": [
      "open-ticket",
      "how-to-order",
      "order-panel",
      "order-status",
      "status-order",
      "queue-list",
      "report-problem",
      "payment-check",
      "customer-complaints",
      "komplain-customer"
    ],

    "ACTIVE TICKETS": [
      "ticket",
      "order-\d{4}",
      "ticket-ord",
      "ticket-ord-",
    ],

    "CLOSED TICKETS": [
      "closed",
    ],

    COMMUNITY: [
      "community-chat",
      "content",
      "media-share",
      "music-request",
      "bot-games"
    ],

    "GTA SERVICES": [
      "gta-chat",
      "gta-info",
      "legacy-service",
      "enhanced-service",
      "gta-discussion",
      "gta-testimonials",
      "testimoni-joki-gta",
      "gta"
    ],

    "PC OPTIMIZER": [
      "pc-consultation",
      "optimization-tips",
      "tips-optimization",
      "hyperboostx-info",
      "info-app-hyperboostx",
      "optimizer-service",
      "optimizer-results",
      "optimizer-result",
      "optimizer-testimonials",
      "testimoni-optimizer"
    ],

    "STREAM AREA": [
      "live-notification",
      "stream-schedule",
      "stream-chat",
      "live-accounts",
      "akun-live"
    ],

    EVENTS: [
      "giveaway",
      "event-winner"
    ],

    "SERVER LOGS": [
      "bot-logs",
      "bot-log",
      "join-leave-logs",
      "moderation-logs",
      "moderation-log",
      "admin-logs",
      "staff-logs",
      "staff-log",
      "ticket-logs",
      "order-logs",
      "payment-logs",
      "payment-log",
      "update-bot",
      "incoming-orders",
      "completed-orders",
      "order-masuk",
      "order-selesai"
    ],

    "SERVER STATS": [
      "members",
      "all members",
      "bots"
    ],

    "STAFF AREA": [
      "admin-chat",
      "comand-dev",
      "command-dev",
      "operator-guide",
      "testing-command",
      "bot-testing",
      "bug-report",
      "staff-chat"
    ],

    "VOICE LOUNGE": [
      "room enhanced",
      "room legacy",
      "joki enhanced",
      "joki legacy",
      "boosting enhanced",
      "boosting legacy",
      "chill room",
      "music room",
      "admin room",
      "staff voice",
      "dev room",
      "public voice"
    ]
  };

  // Ignore dynamic ticket channels, closed tickets, and stats channels
  function shouldIgnoreChannel(channelName) {
    const name = channelName.toLowerCase();
    return (
      name.startsWith("ticket-") ||
      name.startsWith("closed-") ||
      name.startsWith("ticket-ord-") ||
      name.includes("testticketwebhook")
    );
  }

  // Ignore server stats channels
  function isStatsChannel(channelName) {
    const name = channelName.toLowerCase();
    return (
      name.startsWith("channels:") ||
      name.startsWith("members:") ||
      name.startsWith("all members:") ||
      name.startsWith("bots:") ||
      name.startsWith("roles:")
    );
  }

  function normalizeCategoryLabel(name) {
    return normalizeName(String(name || "")).replace(/\s+/g, " ").trim();
  }

  // Normalize channel name for category detection
  function normalizeChannelName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/[丨・]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Category aliases for better detection
  const categoryAliases = {
    INFO: ["info", "start here", "welcome", "panduan", "❗ info"],
    STORE: ["store", "hyper store", "shop", "produk", "🏪 store"],
    ORDER: ["order", "ticket", "transaksi", "🛒 order"],
    COMMUNITY: ["community", "komunitas", "general", "🫂 community"],
    STAFF: ["staff", "admin", "operator", "👑 staff"],
    VOICE: ["voice", "room", "vc", "🎙️ voice"]
  };

  // Force category by channel type
  function forceCategoryByChannelType(channel) {
    if (
      channel.type === ChannelType.GuildVoice ||
      channel.type === ChannelType.GuildStageVoice
    ) {
      return "VOICE";
    }
    return null;
  }

  // Detect expected category for channel
  function detectExpectedCategory(channelName, channel) {
    // Force category by type first
    const forced = forceCategoryByChannelType(channel);
    if (forced) return forced;

    const normalized = normalizeChannelName(channelName);

    if (/\bclosed\b/.test(normalized)) {
      return "CLOSED TICKETS";
    }

    if (/\b(?:ticket|order)-\d{4}\b/.test(normalized) || /\b\d{4}\b/.test(normalized) && normalized.includes("-")) {
      return "ACTIVE TICKETS";
    }

    if (normalized.startsWith("all members") || normalized.startsWith("members") || normalized.startsWith("bots")) {
      return "SERVER STATS";
    }

    if (normalized.includes("bot log") || normalized.includes("bot logs") || normalized.includes("moderation log") || normalized.includes("admin log") || normalized.includes("staff log") || normalized.includes("join leave") || normalized.includes("ticket log") || normalized.includes("order log")) {
      return "SERVER LOGS";
    }

    if (normalized.includes("gta") || normalized.includes("legacy") || normalized.includes("enhanced")) {
      return "GTA SERVICES";
    }

    if (normalized.includes("produk") || normalized.includes("product") || normalized.includes("windows office") || normalized.includes("key license") || normalized.includes("license-win")) {
      return "PRODUCTS";
    }

    for (const [category, keywords] of Object.entries(expectedCategoryMap)) {
      const found = keywords.some(keyword => {
        const cleanKeyword = normalizeChannelName(keyword);
        return cleanKeyword && normalized.includes(cleanKeyword);
      });

      if (found) return category;
    }

    return null;
  }

  async function auditServer(guild, templateKey = "gamestore") {
    const template = templateService.getTemplate(templateKey);
    const roleMap = roleService.getRoleMap(guild);
    const expectedRoles = [...new Set(Object.values(roles).filter((entry) => typeof entry === "string"))];

    const report = {
      missingRoles: [],
      missingCategories: [],
      missingChannels: [],
      missingLogChannels: [],
      emptyCategories: [],
      misplacedChannels: [],
      permissionIssues: [],
      verifyIssues: [],
      duplicateRoles: [],
    };

    // Check roles with normalization to handle emojis
    const requiredRoles = ["hypebotx", "owner", "admin", "game booster", "member"];

    const existingRoles = guild.roles.cache.map(role =>
      normalizeName(role.name)
    );

    const missingRoles = requiredRoles.filter(role =>
      !existingRoles.includes(normalizeName(role))
    );

    report.missingRoles = missingRoles;

    // Check for duplicate roles
    const roleCount = new Map();
    guild.roles.cache.forEach(role => {
      const cleanName = normalizeName(role.name);
      if (!roleCount.has(cleanName)) {
        roleCount.set(cleanName, []);
      }
      roleCount.get(cleanName).push(role);
    });

    for (const [name, roles] of roleCount.entries()) {
      if (roles.length > 1 && name !== "everyone") {
        report.duplicateRoles.push({
          name: name.toUpperCase(),
          count: roles.length
        });
      }
    }

    // Check template categories and channels
    for (const categoryTemplate of template.categories) {
      const category = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildCategory &&
          normalizeCategoryLabel(channel.name) === normalizeCategoryLabel(categoryTemplate.name),
      );

      if (!category) {
        report.missingCategories.push(categoryTemplate.name);
        continue;
      }

      for (const channelTemplate of categoryTemplate.channels) {
        const channel = guild.channels.cache.find(
          (entry) =>
            entry.parentId === category.id &&
            entry.type === channelTemplate.type &&
            normalizeChannelName(entry.name) === normalizeChannelName(channelTemplate.name),
        );

        if (!channel) {
          report.missingChannels.push(`${categoryTemplate.name}/${channelTemplate.name}`);
        }
      }
    }

    // Check log channels
    for (const logChannel of Object.values(channelConfig.logChannels)) {
      const found = guild.channels.cache.find(
        (channel) => channel.name === logChannel && typeof channel.send === "function",
      );
      if (!found) {
        report.missingLogChannels.push(logChannel);
      }
    }

    // Check for misplaced channels (but ignore dynamic ones and stats)
    for (const channel of guild.channels.cache.values()) {
      if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(channel.type)) {
        continue;
      }

      // Skip dynamic ticket channels and stats channels
      if (shouldIgnoreChannel(channel.name) || isStatsChannel(channel.name)) {
        continue;
      }

      // Only check channels that match expected categories
      const expectedCategory = detectExpectedCategory(channel.name, channel);
      if (!expectedCategory) {
        continue; // Don't report unrecognized channels as misplaced
      }

      const currentCategory = normalizeCategoryLabel(channel.parent?.name || "TIDAK ADA KATEGORI");
      if (normalizeCategoryLabel(expectedCategory) !== currentCategory && !channel.topic?.startsWith("ticket:")) {
        report.misplacedChannels.push({
          channel: channel.name,
          current: currentCategory,
          expected: expectedCategory
        });
      }

      // Check staff channel permissions
      if (currentCategory === "staff area") {
        const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
        if (!everyoneOverwrite || !everyoneOverwrite.deny.has(PermissionFlagsBits.ViewChannel)) {
          report.permissionIssues.push(`Channel staff \`${channel.name}\` masih berpotensi terbuka ke @everyone.`);
        }
      }
    }

    // Check empty categories
    for (const category of guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildCategory).values()) {
      if (!category.children.cache.size) {
        report.emptyCategories.push(category.name);
      }
    }

    // Check verify panel and roles (scan all text channels for verify button)
    // This is more reliable than guessing by channel name.
    const textChannels = guild.channels.cache.filter(
      (channel) => channel?.isTextBased?.() && typeof channel?.messages?.fetch === "function",
    );

    let foundChannelWithVerifyButton = null;
    let unreadableChannelsCount = 0;

    for (const channel of textChannels.values()) {
      const messages = await channel.messages
        .fetch({ limit: 100 })
        .catch(() => {
          unreadableChannelsCount += 1;
          return null;
        });

      const hasVerifyPanel = messages?.some((message) =>
        message.components?.some((row) =>
          row.components?.some((component) => component.customId === componentIds.verifyButton),
        ),
      );

      if (hasVerifyPanel) {
        foundChannelWithVerifyButton = channel;
        break;
      }
    }

    // If we can't detect verify button, try to distinguish:
    // 1) verify channel doesn't exist at all
    // 2) verify channel exists but bot can't read recent messages/components
    const verifyLikeChannel = guild.channels.cache.find((channel) => {
      if (!channel?.isTextBased?.()) return false;

      const rawName = String(channel.name || "").toLowerCase();
      const rawTopic = String(channel.topic || "").toLowerCase();

      // Match verif/verify even with emoji/symbol noise.
      // Examples covered: "✅丨verify", "verif", "verifikasi", dll (substring based).
      const combined = `${rawName} ${rawTopic}`;
      return /verif/.test(combined) || /verify/.test(combined);
    });

    if (!foundChannelWithVerifyButton) {
      if (!verifyLikeChannel) {
        report.verifyIssues.push("Channel verify belum ada.");
      } else {
        report.verifyIssues.push(
          "Panel verify kemungkinan ada, tapi button verify belum terdeteksi (cek permission bot untuk read message history).",
        );
      }
    }

    if (!roleMap.member) {
      report.verifyIssues.push("Role MEMBER belum ada.");
    }

    logger.info("audit completed", { guildId: guild.id, templateKey, report });
    return report;
  }

  return {
    auditServer,
  };
}

module.exports = {
  createAuditService,
};
