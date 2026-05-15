const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");

const MUSIC_DISABLED_MESSAGE = "Fitur musik sedang dimatikan.";

module.exports = {
  data: new SlashCommandBuilder().setName("queue").setDescription("Lihat queue musik."),
  async execute(interaction, client) {
    const musicEnabled = client.container?.services?.musicService != null;
    if (!musicEnabled) {
      return interaction.reply({ content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}`, flags: MessageFlags.Ephemeral });
    }

    const queue = client.container.services.musicService.getQueue(interaction.guild.id);
    if (!queue) {
      await interaction.reply("Queue musik kosong.");
      return;
    }

    const current = queue.current ? `🎵 Now playing: ${queue.current.title}` : "Belum ada track aktif.";
    const next = queue.tracks.length
      ? queue.tracks.slice(0, 15).map((track, index) => `${index + 1}. ${track.title}`).join("\n")
      : "Tidak ada antrean.";

    const embed = new EmbedBuilder()
      .setTitle("🎶 Music Queue")
      .setColor(0x1db954)
      .setDescription(`${current}\n\n${next}`)
      .setFooter({
        text: `Total tracks: ${queue.tracks.length + (queue.current ? 1 : 0)}`
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
