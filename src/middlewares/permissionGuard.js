const {
  hasAdminPermission,
  hasDjAccess,
  isOwnerOrStaff,
  isVerifiedMember,
} = require("../utils/permissionCheck");

const { MessageFlags } = require("discord.js");
const { safeReply } = require("../utils/discordResponse.js");

async function replyDenied(interaction, content, securityMeta = {}) {
  const logReplyError = (action, error) => {
    interaction?.client?.container?.logger?.warn?.(`${action} failed`, {
      interactionId: interaction?.id,
      guildId: interaction?.guildId,
      userId: interaction?.user?.id,
      message: error?.message || String(error),
    });
  };

  // Full guard logging (security) - best-effort
  try {
    const loggingService = interaction?.client?.container?.services?.loggingService;
    if (loggingService?.logSecurity) {
      await loggingService.logSecurity(
        interaction?.guild,
        "Permission Denied",
        String(content || "Permission denied").slice(0, 200),
        [
          { name: "Actor", value: interaction?.user?.tag || "-", inline: true },
          { name: "User ID", value: interaction?.user?.id || "-", inline: true },
          { name: "CustomID", value: interaction?.customId || "-", inline: false },
          { name: "Command", value: interaction?.commandName || "-", inline: false },
          { name: "Reason", value: securityMeta?.reason || "-", inline: false },
          { name: "Context", value: securityMeta?.context || "-", inline: false },
        ],
      );
    }
  } catch {
    // ignore
  }

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({
      content,
      flags: MessageFlags.Ephemeral,
    }).catch((error) => {
      logReplyError("permission denied followUp", error);
    });
    return;
  }

  await safeReply(interaction, {
    content,
    flags: MessageFlags.Ephemeral,
  }).catch((error) => {
    logReplyError("permission denied reply", error);
  });
}

async function requireAdmin(interaction) {
  if (hasAdminPermission(interaction.member)) {
    return true;
  }

  await replyDenied(interaction, "Command ini butuh permission `Manage Server`.");
  return false;
}

async function isMemberVerified(interaction) {
  const client = interaction?.client;
  const guild = interaction?.guild;
  const userId = interaction?.user?.id;

  if (!guild || !userId) {
    return false;
  }

  let member = null;
  if (guild.members?.fetch) {
    member = await guild.members.fetch(userId).catch(() => null);
  }
  member = member || interaction.member || null;
  if (!member) {
    client?.container?.logger?.warn?.("verify gate check failed: member not found", {
      guildId: guild.id,
      userId,
      customId: interaction.customId,
    });
    return false;
  }

  let memberRoleIds = [];
  const memberRoleCache = member?.roles?.cache;
  if (memberRoleCache) {
    if (typeof memberRoleCache.keys === "function") {
      memberRoleIds = [...memberRoleCache.keys()];
    } else if (typeof memberRoleCache.values === "function") {
      memberRoleIds = [...memberRoleCache.values()]
        .map((role) => role?.id)
        .filter(Boolean);
    }
  }

  const verifiedRoleIds = [
    process.env.VERIFIED_ROLE_ID,
    process.env.VERIFY_ROLE_ID,
    process.env.MEMBER_ROLE_ID,
    ...(String(process.env.VERIFIED_ROLE_IDS || "").split(",").map((x) => x.trim()).filter(Boolean)),
  ].filter(Boolean);

  const hasVerifiedRoleByName = isVerifiedMember(member);
  const hasVerifiedRoleById = verifiedRoleIds.some((roleId) => member.roles.cache.has(roleId));
  const dbVerified = await client?.container?.repositories?.verificationRepository?.isVerified?.(guild.id, userId).catch(() => false);
  const hasVerifiedRole = hasVerifiedRoleByName || hasVerifiedRoleById || Boolean(dbVerified);

  client?.container?.logger?.info?.("verify gate check", {
    userId,
    guildId: guild.id,
    customId: interaction.customId,
    verifiedRoleIds,
    memberRoleIds,
    hasVerifiedRoleByName,
    hasVerifiedRoleById,
    dbVerified,
    hasVerifiedRole,
  });

  return hasVerifiedRole;
}

async function requireVerifiedMember(interaction) {
  if (await isMemberVerified(interaction)) {
    return true;
  }

  await replyDenied(
    interaction,
    "Kamu harus verify dulu sebelum memakai fitur ini. Silakan klik tombol verify terlebih dulu.",
  );
  return false;
}

async function requireMusicController(interaction, musicService) {
  const queue = musicService.getQueue(interaction.guild.id);
  if (!queue) {
    await replyDenied(interaction, "Belum ada queue musik aktif.");
    return { ok: false, queue: null };
  }

  if (!interaction.member?.voice?.channelId) {
    await replyDenied(interaction, "Kamu harus masuk voice channel dulu.");
    return { ok: false, queue };
  }

  if (!hasDjAccess(interaction.member)) {
    await replyDenied(interaction, "Command musik ini butuh role `DJ` atau akses staff.");
    return { ok: false, queue };
  }

  if (!isOwnerOrStaff(interaction.member) && interaction.member.voice.channelId !== queue.voiceChannelId) {
    await replyDenied(interaction, "Kamu harus berada di voice channel musik yang sama.");
    return { ok: false, queue };
  }

  return { ok: true, queue };
}

module.exports = {
  replyDenied,
  requireAdmin,
  requireVerifiedMember,
  requireMusicController,
};
