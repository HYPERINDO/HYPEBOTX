const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("maintenance")
    .setDescription("Toggle maintenance mode (owner only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName("mode").setDescription("on / off").setRequired(true).addChoices(
        { name: "on", value: "on" },
        { name: "off", value: "off" },
      ),
    )
    .addStringOption((option) =>
      option.setName("message").setDescription("Pesan maintenance custom (opsional).").setRequired(false),
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mode = sanitizeText(interaction.options.getString("mode", true), 500);
    const customMessage = sanitizeText(interaction.options.getString("message", false), 500) || "";
    const isOn = mode === "on";

    const { repositories, services } = client.container;
    await repositories.simpleStoreRepository.updateSettings({
      maintenanceMode: isOn,
      maintenanceMessage: customMessage || (isOn ? "🔧 Toko sedang maintenance. Silakan coba lagi nanti." : ""),
      maintenanceUpdatedBy: interaction.user.id,
      maintenanceUpdatedAt: new Date().toISOString(),
    });

    await services.storeOpsService.writeStaffLog(
      interaction,
      "maintenance",
      mode,
      `Maintenance mode ${mode.toUpperCase()}${customMessage ? `: ${customMessage}` : ""}`,
    ).catch((err) => {
      client.container?.logger?.error?.("Failed to write staff log for maintenance", { error: err.message });
    });

    await services.loggingService?.logBot?.(
      interaction.guild,
      `Maintenance Mode ${mode.toUpperCase()}`,
      `Maintenance mode diubah ke **${mode.toUpperCase()}** oleh ${interaction.user.tag}.${customMessage ? `\nPesan: ${customMessage}` : ""}`,
    ).catch((err) => {
      client.container?.logger?.error?.("Failed to log maintenance mode change", { error: err.message });
    });

    return interaction.editReply({
      content: `[OK] Maintenance mode: **${mode.toUpperCase()}**${customMessage ? `\nPesan: ${customMessage}` : ""}`,
    });
  },
};
