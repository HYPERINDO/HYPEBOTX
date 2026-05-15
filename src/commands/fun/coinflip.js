const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("coinflip").setDescription("Lempar koin."),
  async execute(interaction, client) {
    const result = Math.random() > 0.5 ? "Heads" : "Tails";
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await interaction.reply(`Hasil coinflip: **${result}**`);
  },
};
