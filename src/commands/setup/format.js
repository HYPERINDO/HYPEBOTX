const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { getAllFormats } = require("../../templates/orderFormats");
const {
  createOrderFormatEmbed,
  sendOrderFormatPanel,
} = require("../../utils/orderFormatHelper");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

const formatChoices = getAllFormats().map((format) => ({
  name: format.name.replace(" HYPERINDO", "").slice(0, 100),
  value: format.id,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("format")
    .setDescription("Tampilkan format order HYPERINDO.")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Jenis format yang ingin ditampilkan.")
        .setRequired(false)
        .addChoices(...formatChoices),
    ),

  async execute(interaction) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({
        content: "Hanya staff yang bisa menampilkan panel format order.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const formatType = sanitizeText(interaction.options.getString("type"), 500);
    if (formatType) {
      await interaction.channel.send({
        embeds: [createOrderFormatEmbed(formatType)],
      });
    } else {
      await sendOrderFormatPanel(interaction.channel);
    }

    await interaction.reply({
      content: "Format order berhasil dikirim.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
