const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireMusicController } = require("../../middlewares/permissionGuard");
const { safeReply } = require("../../utils/discordResponse.js");

const MUSIC_DISABLED_MESSAGE = "Fitur musik sedang dimatikan.";

module.exports = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause musik."),
  async execute(interaction, client) {
    const musicEnabled = client.container?.services?.musicService != null;
    if (!musicEnabled) {
      return safeReply(interaction, { content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}`, flags: MessageFlags.Ephemeral });
    }

    const access = await requireMusicController(interaction, client.container.services.musicService);
    if (!access.ok) return;

    const result = client.container.services.musicService.pause(interaction.guild.id);
    await safeReply(interaction, result ? "Musik dipause." : "Belum ada musik yang aktif.");
  },
};
