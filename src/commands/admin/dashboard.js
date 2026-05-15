const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Manajemen Web Dashboard Owner")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("start")
        .setDescription("Nyalakan server dashboard web")
    )
    .addSubcommand((sub) =>
      sub.setName("stop")
        .setDescription("Matikan server dashboard web")
    )
    .addSubcommand((sub) =>
      sub.setName("status")
        .setDescription("Cek status dashboard web")
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const backlogService = client.container.services.backlogService;
    if (!backlogService) {
      return interaction.editReply({ content: "Backlog service belum tersedia." });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "start") {
      try {
        const currentUrl = backlogService.getDashboardUrl();
        if (currentUrl) {
          return interaction.editReply({ content: `Dashboard sudah menyala di: ${currentUrl}` });
        }
        
        const result = await backlogService.startOwnerDashboardServer(client);
        await interaction.editReply({ content: `✅ Dashboard Web berhasil dinyalakan!\nAkses di: ${result.url}` });
      } catch (e) {
        await interaction.editReply({ content: `❌ Gagal menyalakan dashboard: ${e.message}` });
      }
    } else if (subcommand === "stop") {
      try {
        await backlogService.stopOwnerDashboardServer();
        await interaction.editReply({ content: `✅ Dashboard Web berhasil dimatikan.` });
      } catch (e) {
        await interaction.editReply({ content: `❌ Gagal mematikan dashboard: ${e.message}` });
      }
    } else if (subcommand === "status") {
      const url = backlogService.getDashboardUrl();
      if (url) {
        await interaction.editReply({ content: `🟢 Dashboard sedang MENYALA.\nURL: ${url}` });
      } else {
        await interaction.editReply({ content: `🔴 Dashboard sedang MATI.` });
      }
    }
  },
};
