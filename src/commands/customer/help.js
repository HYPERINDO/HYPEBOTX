const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, SlashCommandBuilder } = require("discord.js");
const { componentIds } = require("../../utils/constants");
const { safeReply } = require("../../utils/discordResponse.js");

function createCustomerSimpleHelpEmbed({ storeName }) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`🧑‍💻 Customer Simple Mode`)
    .setDescription([
      `Pilih menu yang kamu butuhkan. Semua order dibuat **step-by-step** (nggak bikin bingung).`,
      ``,
      `**Posisi order kamu selalu kelihatan dari status order di bawah.**`,
      ``,
      `Tips: untuk layanan order/pembayaran, lakukan di **ticket** biar aman (data sensitif jangan di chat publik).`,
    ].join("\n"))
    .setFooter({ text: storeName || "HYPEBOTX" });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Bantuan (Customer). Silakan gunakan panel button di channel."),
  async execute(interaction, client) {
    const storeName = client.container?.botConfig?.storeName || "HYPEBOTX";

    const embed = createCustomerSimpleHelpEmbed({ storeName });
    embed.setDescription([
      "Untuk order cepat, gunakan **panel tombol** di channel:",
      "• 🛒 ORDER",
      "• 📦 CEK PESANAN",
      "• 💳 PEMBAYARAN",
      "• 👨‍💻 BANTUAN ADMIN",
      "",
      "Tips: Setelah ticket order dibuat, semua step ada di dalam ticket (lanjut checkout, payment, bantuan admin).",
    ].join("\n"));

    await safeReply(interaction, {
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
