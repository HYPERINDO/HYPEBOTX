const { SlashCommandBuilder } = require("discord.js");
const askCommand = require("./ask");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Alias /ask untuk tanya AI HYPEBOTX.")
    .addStringOption((opt) =>
      opt
        .setName("question")
        .setDescription("Pertanyaan untuk AI.")
        .setRequired(true),
    ),
  async execute(interaction, client) {
    return askCommand.execute(interaction, client);
  },
};
