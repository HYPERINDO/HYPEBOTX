const {
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");

const roleNames = require("../config/roles");
const { ensureCategory } = require("../utils/ensureCategory");
const { ensureChannel } = require("../utils/ensureChannel");
const { normalizeTextChannelName, normalizeVoiceChannelName } = require("../utils/normalizeName");
const { categoryKeywords } = require("../utils/constants");

const MAX_CHANNELS_PER_CATEGORY = 50;

const CATEGORY_RENAMES = {
  info: "📌・INFO",
  "start-here": "📌・INFO",
  "store-event": "🛒・STORE",
  store: "🛒・STORE",
  order: "🧾・ORDER CENTER",
  "order-center": "🧾・ORDER CENTER",
  produk: "🎮・PRODUCTS",
  products: "🎮・PRODUCTS",
  optimizer: "⚡・PC OPTIMIZER",
  "pc-optimizer": "⚡・PC OPTIMIZER",
  "community-2": "👾・COMMUNITY",
  community: "👾・COMMUNITY",
  result: "⚡・PC OPTIMIZER",
  "result-testimoni": "⚡・PC OPTIMIZER",
  "result-and-testimoni": "⚡・PC OPTIMIZER",
  stream: "📡・STREAM AREA",
  "stream-area": "📡・STREAM AREA",
  event: "🎉・EVENTS",
  events: "🎉・EVENTS",
  staff: "🛡️・STAFF AREA",
  "staff-area": "🛡️・STAFF AREA",
  logs: "📁・SERVER LOGS",
  "server-logs": "📁・SERVER LOGS",
  "server-stats": "📊・SERVER STATS",
  voice: "🔊・VOICE LOUNGE",
  "voice-lounge": "🔊・VOICE LOUNGE",
  support: "🧾・ORDER CENTER",
  gta: "🚗・GTA SERVICES",
  "gta-services": "🚗・GTA SERVICES",
  "ticket-center": "🎫・ACTIVE TICKETS",
  "active-tickets": "🎫・ACTIVE TICKETS",
  "closed-tickets": "🔒・CLOSED TICKETS",
};

const TEXT_CHANNEL_RENAMES = {
  welcome: "👋丨welcome",
  rules: "📜丨rules",
  announcements: "📢丨announcements",
  faq: "📘丨faq",
  "choose-role": "🎭丨choose-role",
  verify: "✅丨verify",
  "social-links": "🌐丨social-links",
  "price-list": "💸丨price-list",
  promo: "🎁丨promo",
  "stock-update": "📦丨stock-update",
  "account-estalase": "🆔丨account-showcase",
  "account-showcase": "🆔丨account-showcase",
  "payment-methode": "🏧丨payment-method",
  "payment-method": "🏧丨payment-method",
  "payment-proof": "🧾丨payment-proof",
  "payment-log": "📦丨order-logs",
  "payment-logs": "📦丨order-logs",
  "payment-check": "payment-check",
  "claim-warranty": "🛡️丨claim-warranty",
  "produk-steam": "🎮丨steam-products",
  "steam-products": "🎮丨steam-products",
  "produk-rockstar": "⭐丨rockstar-products",
  "rockstar-products": "⭐丨rockstar-products",
  "produk-epic": "🕹️丨epic-products",
  "epic-products": "🕹️丨epic-products",
  "key-license-win-plus-office": "🪟丨windows-office-key",
  "windows-office-key": "🪟丨windows-office-key",
  "optimizer-windows": "⚙️丨optimizer-windows",
  "joki-game": "🚀丨game-boosting",
  "game-boosting": "🚀丨game-boosting",
  "top-up-game": "💎丨game-top-up",
  "game-top-up": "💎丨game-top-up",
  "jual-akun": "🛍️丨account-market",
  "account-market": "🛍️丨account-market",
  "setting-account": "🔧丨account-settings",
  "account-settings": "🔧丨account-settings",
  "how-to-order": "🛒丨how-to-order",
  "order-panel": "🛎️丨order-panel",
  "open-ticket": "🎟️丨open-ticket",
  "status-order": "📦丨order-status",
  "order-status": "📦丨order-status",
  "queue-list": "📝丨queue-list",
  "komplain-customer": "🆘丨report-problem",
  "customer-complaints": "🆘丨report-problem",
  support: "🆘丨report-problem",
  "report-problem": "🆘丨report-problem",
  "order-masuk": "📦丨order-logs",
  "incoming-orders": "📦丨order-logs",
  "order-selesai": "📦丨order-logs",
  "completed-orders": "📦丨order-logs",
  "order-logs": "📦丨order-logs",
  "ticket-logs": "🎫丨ticket-logs",
  "gta-info": "ℹ️丨gta-info",
  legacy: "🟢丨legacy-service",
  enhanced: "🟡丨enhanced-service",
  "legacy-service": "🟢丨legacy-service",
  "enhanced-service": "🟡丨enhanced-service",
  "gta-chat": "💬丨gta-chat",
  "gta-discussion": "💬丨gta-chat",
  "testimoni-joki-gta": "🏆丨gta-testimonials",
  "gta-boosting-testimonials": "🏆丨gta-testimonials",
  "gta-testimonials": "🏆丨gta-testimonials",
  "pc-consultation": "💬丨pc-consultation",
  "testimoni-optimizer": "🏆丨optimizer-testimonials",
  "optimizer-testimonials": "🏆丨optimizer-testimonials",
  "optimizer-result": "📈丨optimizer-results",
  "optimizer-results": "📈丨optimizer-results",
  "tips-optimization": "💡丨optimization-tips",
  "optimization-tips": "💡丨optimization-tips",
  "info-app-hyperboostx": "📱丨hyperboostx-info",
  "hyperboostx-info": "📱丨hyperboostx-info",
  "optimizer-service": "⚡丨optimizer-service",
  "live-notification": "🔴丨live-notification",
  "stream-schedule": "🗓️丨stream-schedule",
  "stream-chat": "💬丨stream-chat",
  "akun-live": "👤丨live-accounts",
  "live-accounts": "👤丨live-accounts",
  giveaway: "🎁丨giveaway",
  "event-winner": "🏆丨event-winner",
  "community-chat": "💬丨community-chat",
  content: "🎥丨content",
  "media-share": "📸丨media-share",
  "music-request": "🎵丨music-request",
  "bot-games": "🎮丨bot-games",
  "command-dev": "🧪丨bot-testing",
  "testing-command": "🧪丨bot-testing",
  "bot-testing": "🧪丨bot-testing",
  "staff-chat": "💬丨staff-chat",
  "admin-chat": "👑丨admin-chat",
  "operator-guide": "📚丨operator-guide",
  "bug-report": "🐞丨bug-report",
  "bot-log": "🤖丨bot-logs",
  "bot-logs": "🤖丨bot-logs",
  "join-leave-logs": "📥丨join-leave-logs",
  "moderation-log": "🔨丨moderation-logs",
  "moderation-logs": "🔨丨moderation-logs",
  "admin-logs": "📊丨admin-logs",
  "staff-log": "📊丨admin-logs",
  "staff-logs": "📊丨admin-logs",
  "update-bot": "🤖丨bot-logs",
  "all-members": "👥丨all-members",
  members: "👤丨members",
  bots: "🤖丨bots",
};

const VOICE_CHANNEL_RENAMES = {
  "joki legacy": "🟢丨room-legacy",
  "joki enhanced": "🟡丨room-enhanced",
  "boosting legacy": "🟢丨room-legacy",
  "boosting enhanced": "🟡丨room-enhanced",
  "it dev": "💬丨chill-room",
  "dev room": "💬丨chill-room",
  "admin room": "👑丨admin-room",
  "admin-room": "👑丨admin-room",
  "music room": "🎵丨music-room",
  "music-room": "🎵丨music-room",
  "room legacy": "🟢丨room-legacy",
  "room-legacy": "🟢丨room-legacy",
  "room enhanced": "🟡丨room-enhanced",
  "room-enhanced": "🟡丨room-enhanced",
  "chill room": "💬丨chill-room",
  "chill-room": "💬丨chill-room",
  "staff voice": "🛡️丨staff-voice",
  "staff-voice": "🛡️丨staff-voice",
  "public voice": "💬丨chill-room",
  "public-voice": "💬丨chill-room",
};

function countChannelsInCategory(guild, categoryId) {
  return guild.channels.cache.filter((ch) => ch.parentId === categoryId).size;
}

function normalizeCategoryName(name) {
  return normalizeTextChannelName(
    String(name || "").replace(/[^a-zA-Z0-9\s-]/g, " "),
  );
}

function buildCategoryCountMap(guild) {
  const counts = new Map();

  for (const category of guild.channels.cache.values()) {
    if (category.type !== ChannelType.GuildCategory) {
      continue;
    }

    counts.set(category.id, countChannelsInCategory(guild, category.id));
  }

  return counts;
}

function findCategoryByName(guild, name) {
  const targetName = normalizeCategoryName(name);
  return guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      normalizeCategoryName(ch.name) === targetName,
  );
}

function resolveCategoryName(name) {
  const normalized = normalizeCategoryName(name);
  return CATEGORY_RENAMES[normalized] || name;
}

function resolveTextChannelName(name) {
  const normalized = normalizeTextChannelName(name);
  return TEXT_CHANNEL_RENAMES[normalized] || normalized;
}

function resolveVoiceChannelName(name) {
  const normalized = normalizeVoiceChannelName(name);
  const key = normalized.toLowerCase();
  return VOICE_CHANNEL_RENAMES[key] || normalized;
}

async function getAvailableCategory(guild, baseName, categoryCounts = new Map()) {
  let index = 1;

  while (index <= 20) {
    const categoryName = index === 1 ? baseName : `${baseName} ${index}`;

    let category = findCategoryByName(guild, categoryName);

    if (!category) {
      category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        reason: `Auto create category for /rapihin: ${categoryName}`,
      });

      categoryCounts.set(category.id, 0);
      return category;
    }

    if (category.name !== categoryName) {
      await category.setName(categoryName, `Rapihin nama category: ${categoryName}`);
    }

    const totalChannels = categoryCounts.has(category.id)
      ? categoryCounts.get(category.id)
      : countChannelsInCategory(guild, category.id);

    if (!categoryCounts.has(category.id)) {
      categoryCounts.set(category.id, totalChannels);
    }

    if (totalChannels < MAX_CHANNELS_PER_CATEGORY) {
      return category;
    }

    index++;
  }

  throw new Error(`Semua kategori untuk ${baseName} sudah penuh.`);
}

function canonicalCategoryName(name) {
  return resolveCategoryName(name);
}

function canonicalChannelName(name, type = ChannelType.GuildText) {
  if (type === ChannelType.GuildVoice) {
    return resolveVoiceChannelName(name);
  }
  return resolveTextChannelName(name);
}

function createStructureService({
  botConfig,
  logger,
  repositories,
  templateService,
  roleService,
  loggingService,
}) {
  function buildOverwrites(guild, roleMap, visibility, writableBy, type) {
    const overwriteMap = new Map();

    const allowTextRead = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
    const allowTextWrite = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
    const allowVoice = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];

    function mergeOverwrite(targetId, allow = [], deny = []) {
      const current = overwriteMap.get(targetId) || {
        id: targetId,
        allow: new Set(),
        deny: new Set(),
      };

      for (const permission of allow) {
        current.allow.add(permission);
        current.deny.delete(permission);
      }

      for (const permission of deny) {
        current.deny.add(permission);
        current.allow.delete(permission);
      }

      overwriteMap.set(targetId, current);
    }

    function addRole(role, allow = [], deny = []) {
      if (!role?.id) {
        return;
      }
      mergeOverwrite(role.id, allow, deny);
    }

    const memberAllow = type === ChannelType.GuildVoice ? allowVoice : [...allowTextRead, ...(writableBy === "member" ? allowTextWrite : [])];
    const verifyAllow = type === ChannelType.GuildVoice ? allowVoice : [...allowTextRead];
    const staffAllow = type === ChannelType.GuildVoice ? [...allowVoice, PermissionFlagsBits.MoveMembers] : [...allowTextRead, ...allowTextWrite, PermissionFlagsBits.ManageMessages];
    const readonlyDeny = type === ChannelType.GuildVoice ? [] : [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions];

    mergeOverwrite(guild.roles.everyone.id, [], [PermissionFlagsBits.ViewChannel]);

    if (visibility === "verify") {
      addRole(roleMap.unverified, verifyAllow, writableBy === "readonly" ? readonlyDeny : []);
      addRole(roleMap.member, verifyAllow, writableBy === "readonly" ? readonlyDeny : []);
    }

    if (visibility === "member") {
      // Gate akses kategori "member" berdasarkan self-role.
      // Tambahkan fallback MEMBER agar visibility tidak buntu jika overwrites LEGACY/ENHANCED tidak terpasang/terbaca seperti yang diharapkan.
      addRole(roleMap.legacy, memberAllow, writableBy === "readonly" ? readonlyDeny : []);
      addRole(roleMap.enhanced, memberAllow, writableBy === "readonly" ? readonlyDeny : []);
      addRole(roleMap.member, memberAllow, writableBy === "readonly" ? readonlyDeny : []);
    }

    if (visibility === "staff") {
      addRole(roleMap.admin, staffAllow, []);
      addRole(roleMap.staff, staffAllow, []);
      addRole(roleMap.itDev, staffAllow, []);
    }

    addRole(roleMap.owner, type === ChannelType.GuildVoice ? allowVoice : [...allowTextRead, ...allowTextWrite], []);
    addRole(roleMap.admin, visibility === "staff" ? staffAllow : type === ChannelType.GuildVoice ? allowVoice : [...allowTextRead, ...allowTextWrite], []);
    addRole(roleMap.staff, visibility === "staff" ? staffAllow : type === ChannelType.GuildVoice ? allowVoice : [...allowTextRead, ...allowTextWrite], []);
    addRole(roleMap.itDev, visibility === "staff" ? staffAllow : type === ChannelType.GuildVoice ? allowVoice : [...allowTextRead, ...allowTextWrite], []);

    if (roleMap.muted && type !== ChannelType.GuildVoice) {
      addRole(roleMap.muted, [], [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]);
    }

    return [...overwriteMap.values()].map((entry) => ({
      id: entry.id,
      allow: [...entry.allow],
      deny: [...entry.deny],
    }));
  }

  async function ensureTemplate(guild, templateKey = "gamestore") {
    const summary = { categories: 0, channels: 0 };
    const template = templateService.getTemplate(templateKey);

    await roleService.ensureRoles(guild);
    const roleMap = roleService.getRoleMap(guild);

    const categoryCounts = buildCategoryCountMap(guild);
    let categoryPosition = 0;

    for (const categoryTemplate of template.categories) {
      const availableCategory = await getAvailableCategory(guild, categoryTemplate.name, categoryCounts);
      let channelPosition = 0;

      if (availableCategory.position !== categoryPosition) {
        await availableCategory.setPosition(categoryPosition);
        summary.categories += 1;
      }

      for (const channelTemplate of categoryTemplate.channels) {
        const overwrites = buildOverwrites(
          guild,
          roleMap,
          channelTemplate.visibility,
          channelTemplate.writableBy,
          channelTemplate.type,
        );

        const channel = await ensureChannel(guild, availableCategory, channelTemplate, overwrites);
        await channel.setPosition(channelPosition++);
        summary.channels += 1;

        // Refresh the category count after ensuring the channel
        categoryCounts.set(
          availableCategory.id,
          countChannelsInCategory(guild, availableCategory.id),
        );
      }

      categoryPosition++;
    }

    await repositories.guildRepository.upsert(guild.id, {
      templateKey,
      setupCompleted: true,
    });

    await loggingService.logBot(
      guild,
      "Template Applied",
      `Template \`${template.label}\` selesai disinkronkan.`,
      [
        { name: "Kategori", value: String(summary.categories), inline: true },
        { name: "Channel", value: String(summary.channels), inline: true },
      ],
    );

    logger.info("template ensured", { guildId: guild.id, templateKey, summary });
    return summary;
  }

  async function renameChannels(guild) {
    const changed = [];

    for (const channel of guild.channels.cache.values()) {
      if (channel.type === ChannelType.GuildCategory) {
        const currentName = channel.name;
        const nextName = resolveCategoryName(currentName);
        if (nextName && nextName !== currentName) {
          await channel.setName(nextName, "Rapihin nama category");
          changed.push(`${currentName} -> ${nextName}`);
        }
      }

      if (channel.type === ChannelType.GuildText) {
        const currentName = channel.name;
        const nextName = resolveTextChannelName(currentName);
        if (nextName && nextName !== currentName) {
          await channel.setName(nextName, "Rapihin nama text channel");
          changed.push(`${currentName} -> ${nextName}`);
        }
      }

      if (channel.type === ChannelType.GuildVoice) {
        const currentName = channel.name;
        const nextName = resolveVoiceChannelName(currentName);
        if (nextName && nextName !== currentName) {
          await channel.setName(nextName, "Rapihin nama voice channel");
          changed.push(`${currentName} -> ${nextName}`);
        }
      }
    }

    return changed;
  }

  async function sortChannels(guild, templateKey = "gamestore") {
    const template = templateService.getTemplate(templateKey);
    let categoryIndex = 0;

    for (const categoryTemplate of template.categories) {
      const category = guild.channels.cache.find(
        (entry) =>
          entry.type === ChannelType.GuildCategory &&
          normalizeCategoryName(entry.name) === normalizeCategoryName(categoryTemplate.name),
      );

      if (!category) {
        continue;
      }

      await category.setPosition(categoryIndex++);

      let position = 0;
      for (const channelTemplate of categoryTemplate.channels) {
        const channel = guild.channels.cache.find(
          (entry) =>
            entry.parentId === category.id &&
            entry.type === channelTemplate.type &&
            normalizeTextChannelName(entry.name) === normalizeTextChannelName(channelTemplate.name),
        );

        if (channel) {
          await channel.setPosition(position++);
        }
      }
    }
  }

  function inferCategory(channelName, channelType) {
    if (channelType === ChannelType.GuildVoice) {
      return "🎙️ VOICE";
    }

    const normalized = normalizeTextChannelName(channelName).toLowerCase().replace(/\s+/g, "-");

    // Skip ticket channels - handled separately
    if (normalized.startsWith("closed") || normalized.includes("closed-")) {
      return "⛔ CLOSED TICKETS";
    }

    if (/\b(?:ticket|order)-\d{4}\b/.test(normalized) || (normalized.includes("-") && /\d{4}/.test(normalized))) {
      return "🎫 TICKET CENTER";
    }

    // Map old category names to new ones
    const oldCategoryMap = {
      "start here": "📌 INFO",
      "order center": "🛒 ORDER",
      "store event": "🎉 EVENT",
      "stream area": "📡 STREAM",
      "result & testimoni": "🏆 RESULT",
      "support": "🛒 ORDER",
      "pc optimizer": "⚡ OPTIMIZER",
      "admin": "👑 STAFF",
      "community": "💬 COMMUNITY",
      "gta": "🎮 GTA",
      "logs": "📂 LOGS",
      "result": "🏆 RESULT",
      "voice": "🎙️ VOICE",
      "server stats": "📊 SERVER STATS",
      "ticket center": "🎫 TICKET CENTER",
      "closed tickets": "⛔ CLOSED TICKETS",
    };

    // Check if channel is in an old category
    if (channel.parent?.name && oldCategoryMap[normalizeCategoryName(channel.parent.name).toLowerCase()]) {
      return oldCategoryMap[normalizeCategoryName(channel.parent.name).toLowerCase()];
    }

    if (normalized.startsWith("all-members") || normalized.startsWith("members") || normalized.startsWith("bots") || normalized.startsWith("channels") || normalized.startsWith("roles")) {
      return "📊 SERVER STATS";
    }

    if (normalized.includes("bot-log") || normalized.includes("bot-logs") || normalized.includes("moderation-log") || normalized.includes("admin-log") || normalized.includes("staff-log") || normalized.includes("join-leave")) {
      return "📂 LOGS";
    }

    if (normalized.includes("gta") || normalized.includes("legacy") || normalized.includes("enhanced")) {
      return "🎮 GTA";
    }

    if (normalized.includes("produk") || normalized.includes("windows-office") || normalized.includes("key-license") || normalized.includes("license-win")) {
      return "🛍️ PRODUK";
    }

    if (normalized.includes("testimoni") || normalized.includes("optimizer-result")) {
      return "🏆 RESULT";
    }

    if (normalized.includes("live") || normalized.includes("stream")) {
      return "📡 STREAM";
    }

    if (normalized.includes("event") || normalized.includes("giveaway")) {
      return "🎉 EVENT";
    }

    if (normalized.includes("tips") || normalized.includes("consultation") || normalized.includes("app")) {
      return "⚡ OPTIMIZER";
    }

    // Check standard categories
    for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => normalized.includes(keyword))) {
        // Map to emoji-prefixed category names
        const emojiMap = {
          INFO: "📌 INFO",
          STORE: "🏪 STORE",
          ORDER: "🛒 ORDER",
          COMMUNITY: "💬 COMMUNITY",
          STAFF: "👑 STAFF",
          VOICE: "🎙️ VOICE",
          PRODUK: "🛍️ PRODUK",
          LOGS: "📂 LOGS",
          "TICKET CENTER": "🎫 TICKET CENTER",
          "CLOSED TICKETS": "⛔ CLOSED TICKETS",
          "SERVER STATS": "📊 SERVER STATS",
          GTA: "🎮 GTA",
          RESULT: "🏆 RESULT",
          STREAM: "📡 STREAM",
          OPTIMIZER: "⚡ OPTIMIZER",
          EVENT: "🎉 EVENT",
        };

        return emojiMap[categoryName] || categoryName;
      }
    }

    // Default to COMMUNITY for unknown channels
    return "💬 COMMUNITY";
  }

  function inferTargetCategory(channelName, channelType) {
    if (channelType === ChannelType.GuildVoice) {
      return "🔊・VOICE LOUNGE";
    }

    const normalized = normalizeTextChannelName(channelName).toLowerCase().replace(/\s+/g, "-");
    const finalName = resolveTextChannelName(normalized);

    if (normalized.startsWith("closed") || normalized.includes("closed-")) {
      return "🔒・CLOSED TICKETS";
    }

    if (/\b(?:ticket|order)-\d{4}\b/.test(normalized) || (normalized.includes("-") && /\d{4}/.test(normalized))) {
      return "🎫・ACTIVE TICKETS";
    }

    const exactCategoryByName = {
      welcome: "📌・INFO",
      rules: "📌・INFO",
      announcements: "📌・INFO",
      faq: "📌・INFO",
      "choose-role": "📌・INFO",
      verify: "📌・INFO",
      "social-links": "📌・INFO",
      "price-list": "🛒・STORE",
      promo: "🛒・STORE",
      "stock-update": "🛒・STORE",
      "account-showcase": "🛒・STORE",
      "payment-method": "🛒・STORE",
      "payment-proof": "🛒・STORE",
      "claim-warranty": "🛒・STORE",
      "steam-products": "🎮・PRODUCTS",
      "epic-products": "🎮・PRODUCTS",
      "rockstar-products": "🎮・PRODUCTS",
      "windows-office-key": "🎮・PRODUCTS",
      "optimizer-windows": "🎮・PRODUCTS",
      "game-boosting": "🎮・PRODUCTS",
      "game-top-up": "🎮・PRODUCTS",
      "account-market": "🎮・PRODUCTS",
      "account-settings": "🎮・PRODUCTS",
      "how-to-order": "🧾・ORDER CENTER",
      "order-panel": "🧾・ORDER CENTER",
      "open-ticket": "🧾・ORDER CENTER",
      "order-status": "🧾・ORDER CENTER",
      "queue-list": "🧾・ORDER CENTER",
      "report-problem": "🧾・ORDER CENTER",
      "gta-info": "🚗・GTA SERVICES",
      "legacy-service": "🚗・GTA SERVICES",
      "enhanced-service": "🚗・GTA SERVICES",
      "gta-chat": "🚗・GTA SERVICES",
      "gta-testimonials": "🚗・GTA SERVICES",
      "pc-consultation": "⚡・PC OPTIMIZER",
      "optimization-tips": "⚡・PC OPTIMIZER",
      "hyperboostx-info": "⚡・PC OPTIMIZER",
      "optimizer-service": "⚡・PC OPTIMIZER",
      "optimizer-results": "⚡・PC OPTIMIZER",
      "optimizer-testimonials": "⚡・PC OPTIMIZER",
      "live-notification": "📡・STREAM AREA",
      "stream-schedule": "📡・STREAM AREA",
      "stream-chat": "📡・STREAM AREA",
      "live-accounts": "📡・STREAM AREA",
      giveaway: "🎉・EVENTS",
      "event-winner": "🎉・EVENTS",
      "community-chat": "👾・COMMUNITY",
      content: "👾・COMMUNITY",
      "media-share": "👾・COMMUNITY",
      "music-request": "👾・COMMUNITY",
      "bot-games": "👾・COMMUNITY",
      "staff-chat": "🛡️・STAFF AREA",
      "admin-chat": "🛡️・STAFF AREA",
      "operator-guide": "🛡️・STAFF AREA",
      "bot-testing": "🛡️・STAFF AREA",
      "bug-report": "🛡️・STAFF AREA",
      "bot-logs": "📁・SERVER LOGS",
      "join-leave-logs": "📁・SERVER LOGS",
      "moderation-logs": "📁・SERVER LOGS",
      "admin-logs": "📁・SERVER LOGS",
      "ticket-logs": "📁・SERVER LOGS",
      "order-logs": "📁・SERVER LOGS",
      "all-members": "📊・SERVER STATS",
      members: "📊・SERVER STATS",
      bots: "📊・SERVER STATS",
    };

    if (exactCategoryByName[finalName]) {
      return exactCategoryByName[finalName];
    }

    for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => finalName.includes(normalizeTextChannelName(keyword)))) {
        return canonicalCategoryName(categoryName);
      }
    }

    return "👾・COMMUNITY";
  }

  async function rapihin(guild, templateKey = "gamestore", mode = "preview") {
    const actions = [];
    const categoryCounts = buildCategoryCountMap(guild);

    for (const channel of guild.channels.cache.values()) {
      if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(channel.type)) {
        continue;
      }

      // Skip ticket channels
      const normalized = normalizeTextChannelName(channel.name).toLowerCase().replace(/\s+/g, "-");
      if (normalized.startsWith("ticket-") || normalized.startsWith("ticket-ord-") || normalized.startsWith("closed-")) {
        actions.push(`⏭️ Skip ticket: \`${channel.name}\``);
        continue;
      }

      const expectedCategory = inferTargetCategory(channel.name, channel.type);
      const currentCategory = channel.parent?.name || "-";
      const targetChannelName = canonicalChannelName(channel.name, channel.type);
      const needsMove = normalizeCategoryName(expectedCategory) !== normalizeCategoryName(currentCategory);
      const needsRename = targetChannelName && targetChannelName !== channel.name;

      if (needsMove || needsRename) {
        actions.push(`Pindah \`${channel.name}\` ke \`${expectedCategory}\``);

        if (mode === "apply") {
          try {
            let targetCategory = await getAvailableCategory(guild, expectedCategory, categoryCounts);
            const previousParentId = channel.parentId;

            if (needsMove && previousParentId !== targetCategory.id) {
              try {
                await channel.edit({
                  parent: targetCategory.id,
                  reason: 'Rapihin struktur server Hyperindo',
                });
              } catch (editError) {
                if (editError?.message?.includes('CHANNEL_PARENT_MAX_CHANNELS')) {
                  categoryCounts.set(
                    targetCategory.id,
                    countChannelsInCategory(guild, targetCategory.id),
                  );

                  targetCategory = await getAvailableCategory(guild, expectedCategory, categoryCounts);
                  await channel.edit({
                    parent: targetCategory.id,
                    reason: 'Rapihin struktur server Hyperindo - fallback category',
                  });
                } else {
                  throw editError;
                }
              }

              actions.push(`✅ Berhasil pindah: ${channel.name} -> ${targetCategory.name}`);
              categoryCounts.set(
                targetCategory.id,
                countChannelsInCategory(guild, targetCategory.id),
              );

              if (previousParentId) {
                categoryCounts.set(
                  previousParentId,
                  Math.max(0, (categoryCounts.get(previousParentId) || 1) - 1),
                );
              }
            } else {
              actions.push(`⏭️ Skip, sudah benar: ${channel.name}`);
            }
            if (needsRename) {
              const previousName = channel.name;
              await channel.setName(targetChannelName, "Rapihin nama channel final");
              actions.push(`Rename ${previousName} -> ${targetChannelName}`);
            }
          } catch (error) {
            actions.push(`❌ Gagal pindah ${channel.name}: ${error.message}`);
            logger.error(`[RAPIHIN] Gagal pindah channel ${channel.name}:`, error);
          }
        }
      }
    }

    if (mode === "apply") {
      await ensureTemplate(guild, templateKey);
      const renamed = await renameChannels(guild);
      await sortChannels(guild, templateKey);
      actions.push(...renamed.map((entry) => `Rename ${entry}`));
      await loggingService.logBot(guild, "Rapihin Server", `Rapihin server dijalankan dengan ${actions.length} aksi.`);
    }

    return actions;
  }

  return {
    ensureTemplate,
    renameChannels,
    sortChannels,
    rapihin,
    buildOverwrites,
  };
}

module.exports = {
  createStructureService,
};
