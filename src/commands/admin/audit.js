const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("audit")
    .setDescription("Audit cepat struktur server."),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa audit.", flags: MessageFlags.Ephemeral });
      return;
    }

    const loggingService = client.container.services?.loggingService;

    const report = await client.container.services.auditService.auditServer(interaction.guild, "gamestore");

    // Audit result -> audit trail (best-effort, tidak mengganggu UX)
    try {
      const summary = [
        `Missing category: ${report.missingCategories?.length || 0}`,
        `Missing channel: ${report.missingChannels?.length || 0}`,
        `Empty category: ${report.emptyCategories?.length || 0}`,
      ].join("\n");

      await loggingService?.logAdminAction?.(
        interaction.guild,
        "Audit Server Completed",
        `Admin ${interaction.user.tag} menjalankan auditServer(gamestore).`,
        [
          { name: "Actor", value: interaction.user.tag, inline: true },
          { name: "User ID", value: interaction.user.id, inline: true },
          { name: "MissingCategory", value: String(report.missingCategories?.length || 0), inline: true },
          { name: "MissingChannel", value: String(report.missingChannels?.length || 0), inline: true },
          { name: "EmptyCategory", value: String(report.emptyCategories?.length || 0), inline: true },
        ],
      );

      // Also runtime/security log if available
      await loggingService?.logRuntime?.(
        interaction.guild,
        "runtime/audit",
        `Audit server report summary:\n${summary}`,
        [{ name: "Guild", value: interaction.guild.id, inline: true }],
      ).catch(() => null);

      await loggingService?.logSecurity?.(
        interaction.guild,
        "audit/server-structure",
        "Audit server structure completed (best-effort).",
        [{ name: "Guild", value: interaction.guild.id, inline: true }],
      ).catch(() => null);
    } catch {
      // best-effort
    }

    await interaction.reply({
      content: [
        "**Audit Server**",
        `Missing category: ${report.missingCategories?.length || 0}`,
        `Missing channel: ${report.missingChannels?.length || 0}`,
        `Empty category: ${report.emptyCategories?.length || 0}`,
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  },
};
