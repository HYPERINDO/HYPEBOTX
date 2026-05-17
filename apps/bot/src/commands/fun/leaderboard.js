const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder().setName("leaderboard").setDescription("Lihat leaderboard fun server."),
  async execute(interaction, client) {
    const entries = await client.container.services.funService.getLeaderboard(interaction.guild);

    if (!entries.length) {
      return safeReply(interaction, "Leaderboard masih kosong.");
    }

    // Split entries into chunks to avoid Discord's 2000 character limit
    const maxEntriesPerMessage = 20; // Conservative limit
    const chunks = [];
    for (let i = 0; i < entries.length; i += maxEntriesPerMessage) {
      chunks.push(entries.slice(i, i + maxEntriesPerMessage));
    }

    // Create embed for first chunk
    const embed = new EmbedBuilder()
      .setTitle("🏆 Server Leaderboard")
      .setColor(0xffd700)
      .setDescription(chunks[0].join("\n"))
      .setFooter({
        text: `Total: ${entries.length} entries${chunks.length > 1 ? ` • Page 1/${chunks.length}` : ""}`
      })
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });

    // Send additional chunks as follow-ups
    for (let i = 1; i < chunks.length; i++) {
      const followUpEmbed = new EmbedBuilder()
        .setTitle("🏆 Server Leaderboard (Continued)")
        .setColor(0xffd700)
        .setDescription(chunks[i].join("\n"))
        .setFooter({ text: `Page ${i + 1}/${chunks.length}` })
        .setTimestamp();

      await interaction.followUp({ embeds: [followUpEmbed] });
    }
  },
};
