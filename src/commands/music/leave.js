const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireMusicController } = require("../../middlewares/permissionGuard");
const { safeReply } = require("../../utils/discordResponse.js");

const MUSIC_DISABLED_MESSAGE = "Fitur musik sedang dimatikan.";

module.exports = {
  data: new SlashCommandBuilder().setName("leave").setDescription("Keluar dari voice channel dan hapus queue."),
  async execute(interaction, client) {
    const musicEnabled = client.container?.services?.musicService != null;
    if (!musicEnabled) {
      return safeReply(interaction, { content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}`, flags: MessageFlags.Ephemeral });
    }

    const access = await requireMusicController(interaction, client.container.services.musicService);
    if (!access.ok) return;

    client.container.services.musicService.leave(interaction.guild.id);
    await safeReply(interaction, "Bot keluar dari voice channel.");
  },
};
