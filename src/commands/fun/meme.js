const { SlashCommandBuilder } = require("discord.js");
const { createEmbed } = require("../../utils/embed");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder().setName("meme").setDescription("Kirim meme ringan."),
  async execute(interaction, client) {
    const meme = client.container.services.funService.randomMeme();
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await safeReply(interaction, {
      embeds: [
        createEmbed({
          title: meme.title,
          description: meme.url,
          color: 0xff8c42,
        }),
      ],
    });
  },
};
