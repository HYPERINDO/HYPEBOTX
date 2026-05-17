const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { sanitizeText, validateInput } = require("../../utils/validators");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Mulai giveaway sederhana.")
    .addStringOption((option) =>
      option.setName("prize").setDescription("Hadiah giveaway").setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName("duration").setDescription("Durasi dalam menit").setRequired(true).setMinValue(1).setMaxValue(1440),
    )
    .addIntegerOption((option) =>
      option.setName("winners").setDescription("Jumlah pemenang").setRequired(false).setMinValue(1).setMaxValue(10),
    )
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    const rawPrize = sanitizeText(interaction.options.getString("prize", true), 500);
    const duration = interaction.options.getInteger("duration", true);
    const winners = interaction.options.getInteger("winners") || 1;

    const prizeValidation = validateInput(rawPrize, { maxLength: 120, required: true });
    if (!prizeValidation.valid) {
      await safeReply(interaction, {
        content: `[ERROR] Prize tidak valid: ${prizeValidation.errors.join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const prize = sanitizeText(rawPrize, 120);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await client.container.services.funService.createGiveaway(interaction, prize, duration, winners);
    await interaction.editReply("Giveaway berhasil dimulai.");
  },
};
