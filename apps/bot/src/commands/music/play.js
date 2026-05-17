const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const { sanitizeText, validateInput } = require("../../utils/validators");

const MUSIC_DISABLED_MESSAGE = "Fitur musik sedang dimatikan.";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Putar musik dari query atau URL.")
    .addStringOption((option) =>
      option.setName("query").setDescription("Judul lagu atau URL").setRequired(true),
    ),
  async execute(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      client.container?.logger?.warn?.("defer reply failed", {
        error: error.message,
        interactionId: interaction?.id,
        guildId: interaction?.guildId,
        userId: interaction?.user?.id,
      });

      try {
        await interaction.editReply({ content: "[ERROR] Gagal memproses request (deferReply error)." });
      } catch (_) {
        // ignore
      }
      return;
    }

    const musicEnabled = client.container?.services?.musicService != null;
    if (!musicEnabled) {
      return interaction
        .editReply({ content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}` })
        .catch(() => interaction.followUp({ content: `[ERROR] ${MUSIC_DISABLED_MESSAGE}`, flags: MessageFlags.Ephemeral }));
    }

    const rawQuery = sanitizeText(interaction.options.getString("query", true), 500);
    const queryValidation = validateInput(rawQuery, { maxLength: 200, required: true });
    if (!queryValidation.valid) {
      await interaction.editReply({
        content: `[ERROR] Input query tidak valid: ${queryValidation.errors.join(", ")}`,
      });
      return;
    }
    const query = sanitizeText(rawQuery, 200);

    client.container?.logger?.info?.("music play received", {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      query,
      userId: interaction.user?.id,
    });

    try {
      const { track } = await client.container.services.musicService.enqueue(interaction, query);

      let sourceLabel = "(YouTube)";
      if (track.source === "soundcloud") {
        sourceLabel = "dari SoundCloud";
      } else if (track.source === "soundcloud-yt") {
        sourceLabel = "dari SoundCloud (YouTube)";
      }

      await interaction
        .editReply(`[OK] Menambahkan **${track.title}** ${sourceLabel} ke queue.`)
        .catch((err) => {
          client.container.logger.error("edit reply failed", { error: err.message });
        });
    } catch (error) {
      const message = String(error?.message || "");
      const expectedUserError =
        message.includes("Track tidak ditemukan.") ||
        message.includes("Kamu harus masuk voice channel dulu.") ||
        message.includes("Bot sedang aktif di voice channel lain.");

      const logMethod = expectedUserError ? "warn" : "error";
      client.container?.logger?.[logMethod]?.("music play failed", {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user?.id,
        query,
        message,
        expectedUserError,
      });
      await interaction
        .editReply({
          content: "[ERROR] Terjadi error saat memutar musik. Coba lagi atau gunakan URL/query lain.",
        })
        .catch((err) => {
          client.container.logger.error("error reply failed", { error: err.message });
        });
    }
  },
};
