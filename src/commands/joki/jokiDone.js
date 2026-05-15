const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { hasJokiCrewAccess } = require("../../utils/permissionCheck");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joki-done")
    .setDescription("Selesaikan order joki pada ticket ini dan kirim pesan status.")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Jenis pesan selesai")
        .setRequired(false)
        .addChoices(
          { name: "Joki Done", value: "done" },
          { name: "Joki Sudah Terbang (Cicilan)", value: "terbang" },
        ),
    ),

  async execute(interaction, client) {
    const { repositories, services } = client.container;

    if (!hasJokiCrewAccess(interaction.member)) {
      await safeReply(interaction, {
        content: "[ERROR] Hanya role GAME BOOSTER / ADMIN / OWNER yang bisa menjalankan ini.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    if (!ticket || ticket.type !== "order") {
      await safeReply(interaction, {
        content: "[ERROR] Command ini hanya bisa dipakai di channel ticket ORDER.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mode = sanitizeText(interaction.options.getString("mode"), 500) || "done";
    const result = await services.jokiService.completeTicketOrder({
      guild: interaction.guild,
      ticket,
      actorUser: interaction.user,
      mode,
    });

    if (!result?.ok) {
      await safeReply(interaction, {
        content: `[ERROR] ${result?.message || "Gagal update status joki."}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const doneMessage = mode === "terbang" ? "joki sudah terbang" : "joki done";
    await interaction.channel.send({
      content: `[JOKI] ${doneMessage}`,
    });

    await safeReply(interaction, {
      content: `[OK] Order ditandai selesai. Pesan terkirim: "${doneMessage}".`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
