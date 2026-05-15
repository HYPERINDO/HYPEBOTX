const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const MUSIC_DISABLED_MESSAGE = "Fitur musik sedang dimatikan.";

module.exports = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Lihat lagu yang sedang diputar."),
  async execute(interaction, client) {
    const musicEnabled = client.container?.services?.musicService != null;
    if (!musicEnabled) {
      return interaction.reply({ content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}`, flags: MessageFlags.Ephemeral });
    }

    const queue = client.container.services.musicService.getQueue(interaction.guild.id);
    await interaction.reply(
      queue?.current ? `Sekarang memutar: **${queue.current.title}**` : "Tidak ada lagu yang sedang diputar.",
    );
  },
};
