const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("trivia").setDescription("Ambil trivia ringan."),
  async execute(interaction, client) {
    const trivia = client.container.services.funService.randomTrivia();
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await interaction.reply(`**Trivia:** ${trivia.question}\n**Jawaban:** ||${trivia.answer}||`);
  },
};
