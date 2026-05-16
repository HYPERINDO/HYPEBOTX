const { SlashCommandBuilder } = require("discord.js");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll angka.")
    .addIntegerOption((option) =>
      option.setName("sides").setDescription("Jumlah sisi dadu").setRequired(false).setMinValue(2).setMaxValue(1000),
    ),
  async execute(interaction, client) {
    const sides = interaction.options.getInteger("sides") || 6;
    const result = Math.floor(Math.random() * sides) + 1;
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await safeReply(interaction, `Kamu roll **d${sides}** dan dapat **${result}**.`);
  },
};
