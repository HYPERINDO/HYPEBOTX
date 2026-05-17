const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { createEmbed } = require("../../utils/embed");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joki-shift")
    .setDescription("Manajemen jadwal shift penjoki")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("set")
        .setDescription("Atur jadwal shift penjoki")
        .addUserOption((option) =>
          option.setName("staff")
            .setDescription("Staff penjoki")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("start")
            .setDescription("Waktu mulai (format YYYY-MM-DD HH:mm)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("end")
            .setDescription("Waktu selesai (format YYYY-MM-DD HH:mm)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("note")
            .setDescription("Catatan shift (opsional)")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("Lihat jadwal shift")
        .addUserOption((option) =>
          option.setName("staff")
            .setDescription("Filter berdasarkan staff penjoki (opsional)")
        )
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const backlogService = client.container.services.backlogService;
    if (!backlogService) {
      return interaction.editReply({ content: "Backlog service belum tersedia." });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const staff = interaction.options.getUser("staff");
      const startStr = sanitizeText(interaction.options.getString("start"), 500);
      const endStr = sanitizeText(interaction.options.getString("end"), 500);
      const note = sanitizeText(interaction.options.getString("note"), 500) || "";

      // Validate date loosely
      const startMs = Date.parse(startStr);
      const endMs = Date.parse(endStr);
      if (isNaN(startMs) || isNaN(endMs)) {
        return interaction.editReply({ content: "Format tanggal tidak valid. Gunakan format seperti `2026-05-13 14:00`." });
      }

      try {
        await backlogService.setJokiShift({
          guildId: interaction.guildId,
          staffUserId: staff.id,
          shiftStartAt: new Date(startMs).toISOString(),
          shiftEndAt: new Date(endMs).toISOString(),
          note,
          setBy: interaction.user.id
        });
        
        await interaction.editReply({ content: `✅ Shift untuk <@${staff.id}> berhasil ditambahkan.\nMulai: <t:${Math.floor(startMs/1000)}:f>\nSelesai: <t:${Math.floor(endMs/1000)}:f>` });
      } catch (e) {
        await interaction.editReply({ content: `❌ Gagal menyimpan shift: ${e.message}` });
      }
    } else if (subcommand === "list") {
      const staff = interaction.options.getUser("staff");
      const shifts = await backlogService.listJokiShifts(interaction.guildId, staff?.id, 30);
      
      if (!shifts || shifts.length === 0) {
        return interaction.editReply({ content: "Belum ada data shift." });
      }

      const lines = shifts.map(s => {
        const startTs = Math.floor(new Date(s.shiftStartAt).getTime() / 1000);
        const endTs = Math.floor(new Date(s.shiftEndAt).getTime() / 1000);
        return `• <@${s.staffUserId}> | <t:${startTs}:t> - <t:${endTs}:t> | ${s.status} ${s.note ? `| *${s.note}*` : ""}`;
      });

      const embed = createEmbed({
        title: "Daftar Jadwal Shift Penjoki",
        description: lines.join("\n"),
        color: 0x3498db
      });

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
