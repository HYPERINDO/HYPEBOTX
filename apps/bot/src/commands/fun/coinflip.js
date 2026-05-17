const { SlashCommandBuilder } = require("discord.js");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder().setName("coinflip").setDescription("Lempar koin."),
  async execute(interaction, client) {
    const result = Math.random() > 0.5 ? "Heads" : "Tails";
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await safeReply(interaction, `Hasil coinflip: **${result}**`);
  },
};
