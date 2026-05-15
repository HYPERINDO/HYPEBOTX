const { MessageFlags } = require("discord.js");
const roles = require("../config/roles");
const { createEmbed } = require("../utils/embed");
const { createVerifyButtonRow } = require("../components/buttons/verifyButton");
const { createRoleSelectRow } = require("../components/selects/roleSelect");
const { normalizeTextChannelName } = require("../utils/normalizeName");

function createVerifyService({
  botConfig,
  logger,
  repositories,
  roleService,
  loggingService,
}) {
  async function sendVerifyPanel(channel) {
    return channel.send({
      embeds: [
        createEmbed({
          title: `Member Access - ${botConfig.storeName}`,
          description: "Klik tombol VERIFY untuk membuka akses member server.",
          color: 0x2ecc71,
        }),
      ],
      components: [createVerifyButtonRow()],
    });
  }

  async function sendRolePanel(channel) {
    return channel.send({
      embeds: [
        createEmbed({
          title: "Game Version Roles",
          description: "Pilih akses role GTA yang kamu pakai: LEGACY atau ENHANCED. Pilihan ini bisa diubah kapan saja.",
        }),
      ],
      components: [createRoleSelectRow()],
    });
  }

  async function handleVerifyButton(interaction) {
    const member = interaction.member;
    const roleMap = roleService.getRoleMap(interaction.guild);
    const memberRole = roleMap.member;
    const unverifiedRole = roleMap.unverified;

    if (!memberRole) {
      await interaction.reply({
        content: "Role MEMBER belum ada di server. Hubungi admin untuk setup role.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const alreadyVerified =
      member.roles.cache.has(memberRole.id) &&
      (!unverifiedRole || !member.roles.cache.has(unverifiedRole.id));

    if (alreadyVerified) {
      await interaction.reply({
        content: "Kamu sudah terverifikasi sebelumnya.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      if (!member.roles.cache.has(memberRole.id)) {
        await roleService.addRole(member, roles.member);
      }
      if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
        await roleService.removeRole(member, roles.unverified);
      }
    } catch (error) {
      const missingPermission = /Missing Permissions/i.test(error?.message || "");
      await interaction.reply({
        content: missingPermission
          ? "Bot tidak punya izin Manage Roles atau posisi role bot lebih rendah dari role MEMBER/UNVERIFIED."
          : "Gagal verify. Coba lagi atau hubungi admin.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: "Verifikasi berhasil. Role MEMBER sudah aktif.",
      flags: MessageFlags.Ephemeral,
    });

    await loggingService.logBot(
      interaction.guild,
      "Member Verified",
      `${interaction.user.tag} berhasil verify dan mendapat role MEMBER.`,
    );
  }

  async function handleRoleSelect(interaction) {
    const selected = new Set(interaction.values);
    const member = interaction.member;

    for (const roleName of roles.selfRoles) {
      if (selected.has(roleName)) {
        await roleService.addRole(member, roleName);
      } else {
        await roleService.removeRole(member, roleName);
      }
    }

    await interaction.reply({
      content: `Role diperbarui: ${interaction.values.length ? interaction.values.join(", ") : "tidak ada role dipilih"}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  async function handleGuildMemberAdd(member) {
    const roleMap = roleService.getRoleMap(member.guild);
    if (roleMap.unverified) {
      await roleService.addRole(member, roles.unverified).catch((error) => {
        logger?.warn?.("failed assign unverified role on join", {
          guildId: member.guild.id,
          userId: member.id,
          message: error.message,
        });
      });
    } else {
      logger?.warn?.("unverified role not found on member join", {
        guildId: member.guild.id,
        userId: member.id,
      });
    }

    await repositories.guildRepository.upsert(member.guild.id, {
      lastJoinAt: new Date().toISOString(),
    });

    const welcomeChannel = member.guild.channels.cache.find(
      (channel) => normalizeTextChannelName(channel.name) === "welcome" && typeof channel.send === "function",
    );

    if (welcomeChannel) {
      await welcomeChannel.send([
        "**WELCOME TO HYPERINDO**",
        "",
        `Halo ${member}, selamat datang di HYPERINDO.`,
        "Akun kamu masih belum terverifikasi.",
        "Silakan klik tombol VERIFY di channel verify untuk membuka akses member.",
        "",
        "Langkah awal:",
        "1. Baca rules server.",
        "2. Klik tombol VERIFY.",
        "3. Pilih role LEGACY atau ENHANCED di channel choose-role.",
        "4. Untuk order, buka ticket lewat open-ticket.",
        "5. Bukti transfer dikirim sebagai gambar di dalam ticket order.",
        "",
        "Catatan penting:",
        "- Transaksi hanya lewat channel/ticket resmi HYPERINDO.",
        "- Jangan kirim password akun di channel publik.",
        "- Simpan bukti pembayaran dan chat transaksi.",
      ].join("\n"));
    }

    await loggingService.logBot(member.guild, "Member Join", `${member.user.tag} masuk server (status awal: UNVERIFIED).`);
    logger.info("member joined", { guildId: member.guild.id, userId: member.id });
  }

  async function handleGuildMemberRemove(member) {
    try {
      const welcomeChannel = member.guild.channels.cache.find(
        (channel) => normalizeTextChannelName(channel.name) === "welcome" && typeof channel.send === "function",
      );

      if (welcomeChannel) {
        await welcomeChannel.send(
          `${member.user.tag} keluar dari HYPERINDO. Total member sekarang: ${member.guild.memberCount ?? "N/A"}.`,
        );
      }
    } catch (error) {
      logger?.error?.("leave message failed", {
        guildId: member.guild.id,
        userId: member.id,
        error: error.message,
      });
    }

    await loggingService.logBot(member.guild, "Member Leave", `${member.user.tag} keluar server.`);
  }

  return {
    sendVerifyPanel,
    sendRolePanel,
    handleVerifyButton,
    handleRoleSelect,
    handleGuildMemberAdd,
    handleGuildMemberRemove,
  };
}

module.exports = {
  createVerifyService,
};
