const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { sanitizeText, validateInput } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stock-update")
    .setDescription("Kirim update stok ke channel saat ini.")
    .addStringOption((option) =>
      option.setName("isi").setDescription("Isi update stok").setRequired(true),
    )
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction) {
    if (!interaction.channel || !interaction.channel.isTextBased?.()) {
      const { safeReply } = require("../../utils/discordResponse");
      await safeReply(interaction, { content: "[ERROR] Command ini hanya bisa dipakai di text channel.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    const rawContent = sanitizeText(interaction.options.getString("isi", true), 500);
    const validation = validateInput(rawContent, { maxLength: 1200, required: true });
    if (!validation.valid) {
      const { safeReply } = require("../../utils/discordResponse");
      await safeReply(interaction, { content: `[ERROR] Isi stock update tidak valid: ${validation.errors.join(", ")}`, flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    const content = sanitizeText(rawContent, 1200);
    await interaction.channel.send(`**Stock Update**\n${content}`);
    const { safeReply } = require("../../utils/discordResponse");
    await safeReply(interaction, { content: "Stock update berhasil dikirim.", flags: MessageFlags.Ephemeral }).catch(() => null);
  },
};
