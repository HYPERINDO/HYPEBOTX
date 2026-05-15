const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { createEmbed } = require("../../utils/embed");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mutasi")
    .setDescription("Manajemen dan sinkronisasi mutasi pembayaran")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("add")
        .setDescription("Input data mutasi masuk secara manual")
        .addStringOption((option) =>
          option.setName("amount")
            .setDescription("Nominal masuk (misal: 50000)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("reference")
            .setDescription("Nomor referensi / bukti trf")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("method")
            .setDescription("Metode (qris / bca / dana dll)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("note")
            .setDescription("Catatan (nama pengirim dll)")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("match")
        .setDescription("Jalankan auto-match mutasi terhadap pending payments")
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const backlogService = client.container.services.backlogService;
    if (!backlogService) {
      return interaction.editReply({ content: "Backlog service belum tersedia." });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      const amount = sanitizeText(interaction.options.getString("amount"), 500);
      const reference = sanitizeText(interaction.options.getString("reference"), 500);
      const method = sanitizeText(interaction.options.getString("method"), 500);
      const note = sanitizeText(interaction.options.getString("note"), 500) || "";

      try {
        const result = await backlogService.addMutationAndMatch({
          guild: interaction.guild,
          amount,
          reference,
          method,
          note,
          source: "manual",
          actorId: interaction.user.id
        });
        
        if (!result.ok) {
          return interaction.editReply({ content: `❌ Gagal menambahkan mutasi: ${result.message}` });
        }
        
        const matchInfo = result.match?.matched > 0 
          ? `\n🎉 Mutasi berhasil ter-match otomatis dengan ${result.match.matched} order!`
          : `\n⚠️ Mutasi disimpan tapi belum ada order dengan nominal yang cocok.`;
          
        await interaction.editReply({ content: `✅ Mutasi Rp${Number(amount).toLocaleString("id-ID")} (${method.toUpperCase()}) disimpan.${matchInfo}` });
      } catch (e) {
        await interaction.editReply({ content: `❌ Terjadi kesalahan: ${e.message}` });
      }
    } else if (subcommand === "match") {
      try {
        const result = await backlogService.runMutationAutoMatch(interaction.guild, { actorId: interaction.user.id });
        const embed = createEmbed({
          title: "Auto-Match Mutasi Selesai",
          description: `Memeriksa ${result.scanned} mutasi yang belum terproses.\nBerhasil mencocokkan: **${result.matched}** pembayaran.`,
          color: 0x3498db
        });
        
        await interaction.editReply({ embeds: [embed] });
      } catch (e) {
        await interaction.editReply({ content: `❌ Gagal menjalankan auto-match: ${e.message}` });
      }
    }
  },
};
