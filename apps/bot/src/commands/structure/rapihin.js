const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { sanitizeText } = require('../../utils/validators');
const { requireAdmin } = require("../../middlewares/permissionGuard");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapihin")
    .setDescription("Preview atau apply rapihin server.")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Mode rapihin")
        .setRequired(false)
        .addChoices(
          { name: "preview", value: "preview" },
          { name: "apply", value: "apply" },
        ),
    )
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    const mode = sanitizeText(interaction.options.getString("mode"), 500) || "preview";

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const actions = await client.container.services.structureService.rapihin(interaction.guild, "gamestore", mode);
      const preview = actions.length ? actions.slice(0, 20).join("\n- ") : "Tidak ada aksi.";

      await interaction.editReply(
        `Mode: \`${mode}\`\nJumlah aksi: ${actions.length}\n${actions.length ? `- ${preview}` : preview}`,
      );
    } catch (error) {
      client.container?.logger?.error?.("rapihin command failed", {
        guildId: interaction.guildId,
        mode,
        message: error.message,
      });

      const message =
        error?.message?.includes("CHANNEL_PARENT_MAX_CHANNELS")
          ? "Gagal rapihin: salah satu kategori sudah penuh 50 channel. Gunakan split kategori cadangan."
          : "Terjadi error saat memproses permintaan. Silakan coba lagi atau hubungi admin.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message });
      } else {
        await safeReply(interaction, {
          content: message,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
