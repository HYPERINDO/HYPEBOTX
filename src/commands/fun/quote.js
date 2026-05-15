const { SlashCommandBuilder } = require("discord.js");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder().setName("quote").setDescription("Ambil quote singkat."),
  async execute(interaction, client) {
    const quote = client.container.services.funService.randomQuote();
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await safeReply(interaction, `"${quote}"`);
  },
};
