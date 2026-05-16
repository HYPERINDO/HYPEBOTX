const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("testwebhook")
    .setDescription("Kirim test log ke webhook error/log."),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await safeReply(interaction, { content: "Hanya staff yang bisa test webhook.", flags: MessageFlags.Ephemeral });
      return;
    }

    const configured = Boolean(client.container.botConfig.logging?.webhookUrl);
    client.container.logger.error("webhook_test", {
      configured,
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      userId: interaction.user.id,
      note: "Jika webhook tersambung, pesan ini muncul realtime di channel webhook.",
    });

    await safeReply(interaction, {
      content: configured
        ? "Test webhook dikirim. Cek channel webhook/log kamu."
        : "Webhook belum dikonfigurasi. Isi ERROR_WEBHOOK_URL di .env lalu restart bot.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
