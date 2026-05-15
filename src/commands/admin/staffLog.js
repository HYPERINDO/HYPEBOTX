const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { clampContent } = require("../../utils/discordResponse");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stafflog")
    .setDescription("Lihat staff log terakhir.")
    .addIntegerOption((option) => option.setName("limit").setDescription("Jumlah log").setRequired(false).setMinValue(1).setMaxValue(20)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa lihat staff log.", flags: MessageFlags.Ephemeral });
      return;
    }
    const limit = interaction.options.getInteger("limit") || 10;
    const rows = await client.container.repositories.simpleStoreRepository.staffLogs.getAll();
    const logs = rows.filter((row) => row.guildId === interaction.guild.id).slice(-limit).reverse();
    const content = logs.length
      ? logs.map((row) => `\`${row.id}\` ${row.action} oleh ${row.actorTag || row.actorId}\nTarget: ${row.target}\n${row.detail || "-"}`).join("\n\n")
      : "Belum ada staff log.";
    await interaction.reply({ content: clampContent(content), flags: MessageFlags.Ephemeral });
  },
};
