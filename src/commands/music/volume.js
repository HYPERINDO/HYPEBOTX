const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireMusicController } = require("../../middlewares/permissionGuard");
const { safeReply } = require("../../utils/discordResponse.js");

const MUSIC_DISABLED_MESSAGE = "Fitur musik sedang dimatikan.";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Atur volume musik.")
    .addIntegerOption((option) =>
      option
        .setName("percent")
        .setDescription("Volume 1-200")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(200),
    ),
  async execute(interaction, client) {
    const musicEnabled = client.container?.services?.musicService != null;
    if (!musicEnabled) {
      return safeReply(interaction, { content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}`, flags: MessageFlags.Ephemeral });
    }

    const access = await requireMusicController(interaction, client.container.services.musicService);
    if (!access.ok) return;

    const percent = interaction.options.getInteger("percent", true);
    const result = client.container.services.musicService.setVolume(interaction.guild.id, percent);
    await safeReply(interaction, result ? `Volume diatur ke ${percent}%.` : "Belum ada queue musik aktif.");
  },
};
