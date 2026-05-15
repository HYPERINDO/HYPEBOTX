const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { hasJokiCrewAccess } = require("../../utils/permissionCheck");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("updatequeue")
    .setDescription("Update status antrian joki.")
    .addStringOption((option) => option.setName("queue_id").setDescription("Queue ID").setRequired(true))
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Status")
        .setRequired(true)
        .addChoices(
          { name: "WAITING", value: "queued" },
          { name: "PROSES", value: "processing" },
          { name: "DONE", value: "completed" },
          { name: "HOLD", value: "hold" },
        ),
    ),
  async execute(interaction, client) {
    if (!hasJokiCrewAccess(interaction.member)) {
      await interaction.reply({ content: "Hanya staff/penjoki yang bisa update queue.", flags: MessageFlags.Ephemeral });
      return;
    }
    const row = await client.container.services.storeOpsService.updateQueue(
      interaction,
      sanitizeText(interaction.options.getString("queue_id", true), 500),
      sanitizeText(interaction.options.getString("status", true), 500),
    );
    await interaction.reply({
      content: row ? `Queue \`${row.id}\` diupdate ke \`${row.status}\`.` : "Queue tidak ditemukan.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
