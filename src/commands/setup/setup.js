const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
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
    .setName("setup")
    .setDescription("Setup cepat server sesuai mode.")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Mode setup")
        .setRequired(false)
        .addChoices(
          { name: "basic", value: "basic" },
          { name: "community", value: "community" },
          { name: "gamestore", value: "gamestore" },
          { name: "roles", value: "roles" },
        ),
    )
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    const mode = sanitizeText(interaction.options.getString("mode"), 500) || "basic";
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (mode === "roles") {
      const summary = await client.container.services.roleService.ensureRoles(interaction.guild);
      await interaction.editReply(
        `Setup roles selesai. Created: ${summary.created.length}, updated: ${summary.updated.length}, failed: ${summary.failed.length}.`,
      );
      return;
    }

    const summary = await client.container.services.structureService.ensureTemplate(interaction.guild, mode);
    if (mode === "gamestore") {
      await sendDefaultPanels(interaction.guild, client.container.services);
    }

    await interaction.editReply(
      `Setup \`${mode}\` selesai. Kategori: ${summary.categories}, channel: ${summary.channels}.`,
    );
  },
};

