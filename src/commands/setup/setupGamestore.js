const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");
const { normalizeTextChannelName } = require("../../utils/normalizeName");

function findTextChannel(guild, normalizedName) {
  return guild.channels.cache.find(
    (channel) => normalizeTextChannelName(channel.name) === normalizedName && channel.isTextBased?.(),
  );
}

async function sendDefaultPanels(guild, services) {
  const verifyChannel = findTextChannel(guild, "verify");
  const roleChannel = findTextChannel(guild, "choose-role") || findTextChannel(guild, "role-select");
  const ticketChannel = findTextChannel(guild, "open-ticket");
  const paymentChannel = findTextChannel(guild, "payment-method") || findTextChannel(guild, "payment-info");
  const promoChannel = findTextChannel(guild, "promo");

  if (verifyChannel) await services.verifyService.sendVerifyPanel(verifyChannel);
  if (roleChannel) await services.verifyService.sendRolePanel(roleChannel);
  if (ticketChannel) await services.ticketService.sendTicketPanel(ticketChannel);
  if (paymentChannel) await services.paymentService.sendPaymentPanel(paymentChannel);
  if (promoChannel) await services.paymentService.sendPromoPanel(promoChannel);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-gamestore")
    .setDescription("Setup penuh struktur GameStore.")
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    // Defer dulu supaya interaction tidak timeout (mencegah DiscordAPIError 10062)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!(await requireAdmin(interaction))) {
      await interaction.editReply({ content: "Kamu tidak punya permission untuk menjalankan ini." }).catch((error) => {
        client.container.logger.warn("setup-gamestore deny editReply failed", {
          guildId: interaction.guildId,
          userId: interaction.user?.id,
          message: error?.message || String(error),
        });
      });
      return;
    }

    const { services } = client.container;
    const summary = await services.structureService.ensureTemplate(interaction.guild, "gamestore");
    await sendDefaultPanels(interaction.guild, services);

    await interaction.editReply(
      `Setup GameStore selesai. Kategori: ${summary.categories}, channel: ${summary.channels}, panel utama sudah dikirim.`,
    );
  },
};
