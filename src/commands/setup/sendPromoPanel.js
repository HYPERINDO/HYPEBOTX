const { PermissionFlagsBits, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");
const { sanitizeText, validateInput } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-promo-panel")
    .setDescription("Kirim promo panel ke channel saat ini.")
    .addStringOption((option) =>
      option.setName("judul").setDescription("Judul promo").setRequired(false),
    )
    .addStringOption((option) =>
      option.setName("isi").setDescription("Isi promo").setRequired(false),
    )
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    if (!(interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || (await requireAdmin(interaction)))) {
      return;
    }

    const rawTitle = sanitizeText(interaction.options.getString("judul"), 500) || "Promo Aktif";
    const rawDescription = sanitizeText(interaction.options.getString("isi"), 500) || "Update promo terbaru akan diposting di sini.";
    const titleValidation = validateInput(rawTitle, { maxLength: 100, required: true });
    const descValidation = validateInput(rawDescription, { maxLength: 1000, required: true });

    if (!titleValidation.valid || !descValidation.valid) {
      const errors = [...titleValidation.errors, ...descValidation.errors];
      await interaction.reply({ content: `[ERROR] Input promo tidak valid: ${errors.join(", ")}`, flags: MessageFlags.Ephemeral });
      return;
    }

    const title = sanitizeText(rawTitle, 100);
    const description = sanitizeText(rawDescription, 1000);

    await client.container.services.paymentService.sendPromoPanel(interaction.channel, title, description);
    await interaction.reply({ content: "Promo panel berhasil dikirim.", flags: MessageFlags.Ephemeral });
  },
};
