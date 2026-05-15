const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireMusicController } = require("../../middlewares/permissionGuard");

const MUSIC_DISABLED_MESSAGE = "Fitur musik sedang dimatikan.";

module.exports = {
  data: new SlashCommandBuilder().setName("loop").setDescription("Toggle loop pada queue."),
  async execute(interaction, client) {
    const musicEnabled = client.container?.services?.musicService != null;
    if (!musicEnabled) {
      return interaction.reply({ content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}`, flags: MessageFlags.Ephemeral });
    }

    const access = await requireMusicController(interaction, client.container.services.musicService);
    if (!access.ok) return;

    const result = client.container.services.musicService.toggleLoop(interaction.guild.id);
    if (result === null) {
      await interaction.reply("Belum ada queue musik aktif.");
      return;
    }

    await interaction.reply(`Loop sekarang: **${result ? "ON" : "OFF"}**.`);
  },
};
