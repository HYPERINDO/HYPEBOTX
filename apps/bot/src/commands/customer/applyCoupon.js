const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("apply-coupon")
    .setDescription("Gunakan kode kupon untuk order aktifmu.")
    .addStringOption((option) =>
      option.setName("code")
        .setDescription("Kode kupon")
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const rawCode = sanitizeText(interaction.options.getString("code"), 500);
    const code = sanitizeText(rawCode, 50);
    const ticketRepo = client.container.database.repositories.ticketRepository;

    // Check if in a ticket
    const ticket = await ticketRepo.findByChannelId(interaction.channelId);
    if (!ticket || ticket.type !== "order") {
      const { safeReply } = require("../../utils/discordResponse");
      return safeReply(interaction, { content: "Command ini hanya bisa digunakan di dalam channel ticket order.", flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const result = await client.container.services.backlogService?.redeemCoupon({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      ticketId: ticket.id,
      code
    });

    if (!result || !result.ok) {
      const { safeReply } = require("../../utils/discordResponse");
      return safeReply(interaction, { content: `❌ Gagal menggunakan kupon: ${result?.message || "Unknown error"}`, flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const { redemption } = result;
    const discountText = redemption.discountAmount !== null ? `(Potongan: Rp${redemption.discountAmount.toLocaleString("id-ID")})` : "";

    const { safeReply } = require("../../utils/discordResponse");
    await safeReply(interaction, { content: `✅ Kupon **${redemption.code}** berhasil diterapkan! ${discountText}\nSilakan tunggu admin mengupdate invoice/order summary.`, flags: MessageFlags.Ephemeral }).catch(() => null);
  },
};
