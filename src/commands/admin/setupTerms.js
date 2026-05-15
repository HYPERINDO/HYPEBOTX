const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-terms")
    .setDescription("Kirim panel persetujuan SOP / Terms untuk customer")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await client.container.services.backlogService?.sendTermsPanel(interaction.channel);

    if (result) {
      await interaction.editReply({ content: "Panel SOP / Terms berhasil dikirim ke channel ini." });
    } else {
      await interaction.editReply({ content: "Gagal mengirim panel SOP / Terms." });
    }
  },
};
