const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText, validateInput } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set status AFK kamu.")
    .addStringOption((option) =>
      option.setName("reason").setDescription("Alasan AFK").setRequired(false),
    ),
  async execute(interaction, client) {
    const rawReason = sanitizeText(interaction.options.getString("reason"), 500) || "Sedang AFK";
    const validation = validateInput(rawReason, { maxLength: 120, required: true });
    if (!validation.valid) {
      await interaction.reply({
        content: `[ERROR] Alasan AFK tidak valid: ${validation.errors.join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const reason = sanitizeText(rawReason, 120);
    await client.container.services.moderationService.setAfk(interaction.user.id, reason);
    await interaction.reply({ content: `AFK diset: ${reason}`, flags: MessageFlags.Ephemeral });
  },
};
