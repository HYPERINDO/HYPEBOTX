const { SlashCommandBuilder } = require("discord.js");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder().setName("trivia").setDescription("Ambil trivia ringan."),
  async execute(interaction, client) {
    const trivia = client.container.services.funService.randomTrivia();
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await safeReply(interaction, `**Trivia:** ${trivia.question}\n**Jawaban:** ||${trivia.answer}||`);
  },
};
