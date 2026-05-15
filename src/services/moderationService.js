const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { blockedWords, scamDomains } = require("../utils/constants");
const roles = require("../config/roles");
const { isOwnerOrStaff } = require("../utils/permissionCheck");
const { createEmbed } = require("../utils/embed");
const { componentIds } = require("../utils/constants");

const MEMES = [
  { title: "Diskon Kelihatan, Saldo Menghilang", url: "https://i.imgflip.com/30b1gx.jpg" },
  { title: "Customer: Bang fast response", url: "https://i.imgflip.com/1bij.jpg" },
  { title: "Game backlog tidak pernah selesai", url: "https://i.imgflip.com/4t0m5.jpg" },
];

const QUOTES = [
  "Pelayanan cepat bikin customer balik lagi.",
  "Server rapi bikin trust naik.",
  "Promo bagus tetap butuh support yang responsif.",
  "Order flow yang jelas lebih penting daripada fitur random.",
];

const TRIVIA = [
  { question: "Platform mana yang identik dengan GTA V?", answer: "Rockstar Games Launcher / Steam / Epic." },
  { question: "Apa fungsi role PROMO PING?", answer: "Menerima notifikasi promo tanpa ping semua member." },
  { question: "Mengapa verify penting di server store?", answer: "Supaya akses publik lebih aman dari spam dan bot." },
];

function createModerationService({
  botConfig,
  logger,
  database,
  roleService,
  loggingService,
}) {
  const messageFloodCache = new Map();
  const buckets = new Map();
  let userAfk = {};
  
  // Anti-Raid states
  const joinHistory = [];
  const RAID_THRESHOLD = 5; // 5 joins
  const RAID_WINDOW = 10000; // in 10 seconds
  let isRaidMode = false;
  let raidModeTimeout = null;

  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
    return null;
  }

  function trackFlood(userId) {
    const now = Date.now();
    const recent = (buckets.get(userId) || []).filter(
      (timestamp) => now - timestamp < botConfig.moderation.floodWindowMs,
    );
    recent.push(now);
    buckets.set(userId, recent);
    return recent.length;
  }

  async function punish(message, reason) {
    await message.delete().catch((error) => {
      logBestEffort("delete moderated message", {
        guildId: message.guild?.id,
        channelId: message.channel?.id,
        userId: message.author?.id,
      }, error);
    });

    if (message.member?.moderatable) {
      await message.member
        .timeout(botConfig.moderation.timeoutMinutes * 60 * 1000, reason)
        .catch((error) => {
          logBestEffort("timeout moderated member", {
            guildId: message.guild?.id,
            userId: message.author?.id,
          }, error);
        });
    } else if (message.member) {
      await roleService.addRole(message.member, roles.muted).catch((error) => {
        logBestEffort("assign muted role", {
          guildId: message.guild?.id,
          userId: message.author?.id,
          role: roles.muted,
        }, error);
      });
    }

    await loggingService.logModeration(
      message.guild,
      "Auto Moderation",
      `${message.author.tag} terkena aksi moderasi.`,
      [
        { name: "Alasan", value: reason, inline: false },
        { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
      ],
    );
  }

  async function handleAfkMentions(message) {
    const afk = await database.read("afk", {});

    if (afk[message.author.id]) {
      delete afk[message.author.id];
      await database.write("afk", afk);
      await message.reply("AFK kamu sudah saya hapus karena kamu aktif lagi.");
    }

    for (const user of message.mentions.users.values()) {
      if (afk[user.id]) {
        await message.reply(`${user.tag} sedang AFK: ${afk[user.id]}`);
      }
    }
  }

  async function handleMessage(message) {
    if (!message.inGuild() || message.author.bot) {
      return;
    }

    await handleAfkMentions(message);

    if (isOwnerOrStaff(message.member)) {
      return;
    }

    const lowered = message.content.toLowerCase();
    const floodCount = trackFlood(message.author.id);
    const userMentions = message.mentions.users.size;
    const roleMentions = message.mentions.roles.size;
    const mentionTotal = userMentions + roleMentions;

    if (message.mentions.everyone) {
      await punish(message, "Mention @everyone/@here terdeteksi");
      return;
    }

    if (roleMentions >= Math.max(2, Math.floor(botConfig.moderation.massMentionThreshold / 2))) {
      await punish(message, "Flood role mention terdeteksi");
      return;
    }

    if (mentionTotal >= botConfig.moderation.massMentionThreshold) {
      await punish(message, "Mass mention terdeteksi");
      return;
    }

    if (scamDomains.some((domain) => lowered.includes(domain))) {
      await punish(message, "Link scam terdeteksi");
      return;
    }

    if (blockedWords.some((word) => lowered.includes(word))) {
      await punish(message, "Kata terlarang terdeteksi");
      return;
    }



    if (floodCount >= botConfig.moderation.floodMessageCount) {
      await punish(message, "Spam / flood terdeteksi");
    }
  }

  async function setAfk(userId, note) {
    const afk = await database.read("afk", {});
    afk[userId] = note || "Sedang AFK";
    await database.write("afk", afk);
    logger.info("afk set", { userId });
  }

  async function addPoints(userId, points = 1) {
    const board = await database.read("leaderboard", {});
    board[userId] = (board[userId] || 0) + points;
    await database.write("leaderboard", board);
  }

  async function createGiveaway(interaction, prize, durationMinutes, winnerCount) {
    const giveaways = await database.read("giveaways", []);
    const giveaway = {
      id: `GW-${Date.now()}`,
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      prize,
      durationMinutes,
      winnerCount,
      participants: [],
      messageId: null,
      ended: false,
      endAt: Date.now() + durationMinutes * 60 * 1000,
    };

    const button = new ButtonBuilder()
      .setCustomId(`${componentIds.giveawayJoinPrefix}${giveaway.id}`)
      .setLabel("Ikut Giveaway")
      .setStyle(ButtonStyle.Success);

    const message = await interaction.channel.send({
      embeds: [
        createEmbed({
          title: "Giveaway Dimulai",
          description: `Hadiah: **${prize}**\nDurasi: **${durationMinutes} menit**\nPemenang: **${winnerCount}**`,
          color: 0xf1c40f,
        }),
      ],
      components: [new ActionRowBuilder().addComponents(button)],
    });

    giveaway.messageId = message.id;
    giveaways.push(giveaway);
    await database.write("giveaways", giveaways);
    await addPoints(interaction.user.id, 2);
    return giveaway;
  }

  async function joinGiveaway(interaction, giveawayId) {
    const giveaways = await database.read("giveaways", []);
    const index = giveaways.findIndex((entry) => entry.id === giveawayId && !entry.ended);
    if (index < 0) {
      await interaction.reply({ content: "Giveaway ini sudah selesai atau tidak ditemukan.", flags: MessageFlags.Ephemeral });
      return;
    }

    const giveaway = giveaways[index];
    if (!giveaway.participants.includes(interaction.user.id)) {
      giveaway.participants.push(interaction.user.id);
      giveaways[index] = giveaway;
      await database.write("giveaways", giveaways);
    }

    await interaction.reply({ content: "Kamu berhasil ikut giveaway.", flags: MessageFlags.Ephemeral });
  }

  async function sweepGiveaways(client) {
    try {
      const giveaways = await database.read("giveaways", []);
      let changed = false;

      for (const giveaway of giveaways) {
        if (giveaway.ended || giveaway.endAt > Date.now()) {
          continue;
        }

        giveaway.ended = true;
        changed = true;

        try {
          const guild = client.guilds.cache.get(giveaway.guildId);
          if (!guild) {
            logger.warn("giveaway sweep guild not found", { guildId: giveaway.guildId });
            continue;
          }

          const channel = guild.channels.cache.get(giveaway.channelId);
          if (!channel) {
            logger.warn("giveaway sweep channel not found", { guildId: giveaway.guildId, channelId: giveaway.channelId });
            continue;
          }

          // Deduplicate participants
          const uniqueParticipants = [...new Set(giveaway.participants || [])];
          const winners = [];

          const entries = [...uniqueParticipants];
          while (entries.length && winners.length < giveaway.winnerCount) {
            const index = Math.floor(Math.random() * entries.length);
            winners.push(entries.splice(index, 1)[0]);
          }

          const message = winners.length
            ? `Giveaway **${giveaway.prize}** selesai. Pemenang: ${winners.map((id) => `<@${id}>`).join(", ")}`
            : `Giveaway **${giveaway.prize}** selesai tanpa peserta yang valid.`;

          await channel.send(message).catch((error) => {
            logger.error("giveaway send message failed", { error: error.message });
          });

          for (const winnerId of winners) {
            await addPoints(winnerId, 5).catch((error) => {
              logger.error("add points failed", { winnerId, error: error.message });
            });
          }
        } catch (error) {
          logger.error("giveaway sweep item error", { error: error.message });
        }
      }

      if (changed) {
        await database.write("giveaways", giveaways).catch((error) => {
          logger.error("giveaway write failed", { error: error.message });
        });
        logger.info("giveaway sweep completed");
      }
    } catch (error) {
      logger.error("giveaway sweep error", { error: error.message });
    }
  }

  async function getLeaderboard() {
    const board = await database.read("leaderboard", {});
    const ranked = Object.entries(board)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return ranked.map(([userId, points], index) => `${index + 1}. <@${userId}> - ${points} pts`);
  }

  async function handleAntiRaid(member) {
    if (member.user.bot) return false;
    
    const now = Date.now();
    joinHistory.push(now);
    
    // Clean up old entries
    while (joinHistory.length > 0 && joinHistory[0] < now - RAID_WINDOW) {
      joinHistory.shift();
    }
    
    if (joinHistory.length >= RAID_THRESHOLD) {
      if (!isRaidMode) {
        isRaidMode = true;
        logger.warn("Anti-Raid triggered", { guildId: member.guild.id, recentJoins: joinHistory.length });
        
        await loggingService.logModeration(
          member.guild,
          "🚨 Anti-Raid System Activated",
          `Terdeteksi **${joinHistory.length}** joins dalam **${RAID_WINDOW/1000}s**.\nMode proteksi aktif: member baru akan otomatis di-kick.`,
          []
        ).catch(() => null);
      }
      
      // Reset raid mode timer
      if (raidModeTimeout) clearTimeout(raidModeTimeout);
      raidModeTimeout = setTimeout(() => {
        isRaidMode = false;
        loggingService.logModeration(
          member.guild,
          "✅ Anti-Raid System Deactivated",
          "Kondisi server sudah normal. Proteksi raid dimatikan otomatis.",
          []
        ).catch(() => null);
      }, 60000); // disable after 1 min of peace
    }
    
    if (isRaidMode) {
      // Auto kick during raid
      await member.send("Server sedang dalam proteksi dari serangan raid. Silakan coba bergabung kembali dalam beberapa menit.").catch(() => null);
      await member.kick("Anti-Raid Auto Kick").catch((error) => {
        logBestEffort("anti-raid kick failed", { userId: member.id }, error);
      });
      return true; // handled
    }
    
    return false; // not handled
  }

  return {
    handleMessage,
    handleAntiRaid,
    setAfk,
    randomMeme() {
      return MEMES[Math.floor(Math.random() * MEMES.length)];
    },
    randomQuote() {
      return QUOTES[Math.floor(Math.random() * QUOTES.length)];
    },
    randomTrivia() {
      return TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
    },
    createGiveaway,
    joinGiveaway,
    sweepGiveaways,
    getLeaderboard,
    addPoints,
  };
}

module.exports = {
  createModerationService,
};
