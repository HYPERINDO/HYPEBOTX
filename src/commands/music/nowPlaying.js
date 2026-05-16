const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { safeReply } = require("../../utils/discordResponse.js");

const MUSIC_DISABLED_MESSAGE = "Fitur musik sedang dimatikan.";

module.exports = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Lihat lagu yang sedang diputar."),
  async execute(interaction, client) {
    const musicEnabled = client.container?.services?.musicService != null;
    if (!musicEnabled) {
      return safeReply(interaction, { content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}`, flags: MessageFlags.Ephemeral });
    }

    const queue = client.container.services.musicService.getQueue(interaction.guild.id);
    await safeReply(interaction, 
      queue?.current ? `Sekarang memutar: **${queue.current.title}**` : "Tidak ada lagu yang sedang diputar.",
    );
  },
};
