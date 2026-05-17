const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Manajemen Web Dashboard HYPEBOTX")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("start")
        .setDescription("Nyalakan server dashboard web"),
    )
    .addSubcommand((sub) =>
      sub.setName("stop")
        .setDescription("Matikan server dashboard web"),
    )
    .addSubcommand((sub) =>
      sub.setName("status")
        .setDescription("Cek status dashboard web"),
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const dashboardService = client.container.services.webDashboardService || client.container.services.backlogService;
    if (!dashboardService) {
      return interaction.editReply({ content: "Dashboard service belum tersedia." });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "start") {
      try {
        const currentUrl = dashboardService.getDashboardUrl();
        if (currentUrl) {
          return interaction.editReply({ content: `Dashboard sudah menyala di: ${currentUrl}` });
        }

        const result = dashboardService.start
          ? await dashboardService.start(client)
          : await dashboardService.startOwnerDashboardServer(client);
        return interaction.editReply({ content: `Dashboard Web berhasil dinyalakan.\nAkses di: ${result.url}` });
      } catch (error) {
        return interaction.editReply({ content: `Gagal menyalakan dashboard: ${error.message}` });
      }
    }

    if (subcommand === "stop") {
      try {
        if (dashboardService.stop) {
          await dashboardService.stop();
        } else {
          await dashboardService.stopOwnerDashboardServer();
        }
        return interaction.editReply({ content: "Dashboard Web berhasil dimatikan." });
      } catch (error) {
        return interaction.editReply({ content: `Gagal mematikan dashboard: ${error.message}` });
      }
    }

    const url = dashboardService.getDashboardUrl();
    return interaction.editReply({
      content: url
        ? `Dashboard sedang MENYALA.\nURL: ${url}`
        : "Dashboard sedang MATI.",
    });
  },
};
