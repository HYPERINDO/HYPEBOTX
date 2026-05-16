const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Cek latency bot."),
  async execute(interaction, client) {
    const wsPing = client?.ws?.ping ?? 0;
    const { safeReply } = require("../../utils/discordResponse");
    await safeReply(interaction, {
      content: `Pong! WebSocket: \`${wsPing}ms\``,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  },
};

