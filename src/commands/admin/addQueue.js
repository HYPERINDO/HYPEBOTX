const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { hasJokiCrewAccess } = require("../../utils/permissionCheck");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addqueue")
    .setDescription("Tambah customer ke antrian joki.")
    .addUserOption((option) => option.setName("customer").setDescription("Customer").setRequired(true))
    .addStringOption((option) => option.setName("ticket_id").setDescription("Ticket ID").setRequired(false))
    .addIntegerOption((option) => option.setName("estimasi_menit").setDescription("Estimasi menit").setRequired(false).setMinValue(1)),
  async execute(interaction, client) {
    if (!hasJokiCrewAccess(interaction.member)) {
      await interaction.reply({ content: "Hanya staff/penjoki yang bisa tambah queue.", flags: MessageFlags.Ephemeral });
      return;
    }
    const result = await client.container.services.storeOpsService.addQueue(
      interaction,
      interaction.options.getUser("customer", true),
      sanitizeText(interaction.options.getString("ticket_id"), 50),
      interaction.options.getInteger("estimasi_menit") || 20,
    );
    await interaction.reply({ content: `Antrian joki siap: \`${result.entry.id}\`${result.reused ? " (sudah ada)" : ""}.`, flags: MessageFlags.Ephemeral });
  },
};
