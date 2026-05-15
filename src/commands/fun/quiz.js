const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("quiz").setDescription("Quiz ringan server."),
  async execute(interaction, client) {
    const trivia = client.container.services.funService.randomTrivia();
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await interaction.reply(`**Quiz:** ${trivia.question}\nJawaban disimpan di spoiler: ||${trivia.answer}||`);
  },
};
