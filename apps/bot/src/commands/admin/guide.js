const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guide")
    .setDescription("Menampilkan panduan cepat")
    .addSubcommand((sub) => sub.setName("admin").setDescription("Panduan untuk Staff/Admin"))
    .addSubcommand((sub) => sub.setName("joki").setDescription("Panduan untuk Penjoki"))
    .addSubcommand((sub) => sub.setName("customer").setDescription("Panduan untuk Customer")),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // Pastikan hanya staff yang bisa panggil admin/joki guide
    if ((subcommand === "admin" || subcommand === "joki") && !isOwnerOrStaff(interaction.member)) {
      return safeReply(interaction, { content: "Hanya staff/joki yang bisa melihat panduan ini.", flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder().setColor("#0099ff");

    if (subcommand === "admin") {
      embed.setTitle("📘 Panduan Staff / Admin");
      embed.setDescription(
        "**Command Penting:**\n" +
        "`/maintenance` - Toggle mode maintenance\n" +
        "`/stock-add`, `/stock-list` - Kelola stok\n" +
        "`/export` - Export data CSV\n" +
        "`/refund`, `/dispute` - Proses refund & masalah\n" +
        "`/order-summary`, `/invoice` - Refresh info tiket order\n" +
        "\n**SOP:**\n" +
        "1. Selalu approve payment setelah bukti divalidasi.\n" +
        "2. Jangan pernah kirim key produk digital full di dalam tiket (Sistem akan auto-DM).\n" +
        "3. Gunakan `/dispute` jika ada komplain sebelum melakukan refund."
      );
    } else if (subcommand === "joki") {
      embed.setTitle("🎮 Panduan Penjoki");
      embed.setDescription(
        "**Flow Kerja:**\n" +
        "1. Saat order masuk, gunakan `/joki-claim` atau update queue.\n" +
        "2. Saat mulai kerja, ketik `joki work` atau klik mark processing.\n" +
        "3. Jika terkendala login/kode, klik tombol **Need Customer Info** atau ketik `joki hold`.\n" +
        "4. Setelah selesai 100%, ketik `joki done` atau klik tombol **Mark Done**.\n\n" +
        "**Penting:** Order yang sudah DONE akan dihilangkan dari active queue."
      );
    } else if (subcommand === "customer") {
      embed.setTitle("🛍️ Panduan Customer");
      embed.setDescription(
        "**Cara Membeli:**\n" +
        "1. Cek harga via `/price`.\n" +
        "2. Buka tiket order di channel pembelian.\n" +
        "3. Lakukan pembayaran dan **upload screenshot** di tiket.\n" +
        "4. Tunggu admin verifikasi.\n" +
        "5. Jika produk digital, sistem akan mengirimkannya ke DM kamu. **Pastikan DM terbuka!**\n\n" +
        "Gunakan `/faq` untuk bantuan lainnya."
      );
    }

    await safeReply(interaction, { embeds: [embed] });
  },
};
