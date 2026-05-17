const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { staffCommand } = require("../../config/permissions");
const { orderStatuses } = require("../../utils/constants");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-order-status")
    .setDescription("Ubah status order pada ticket aktif.")
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Status baru")
        .setRequired(true)
        .addChoices(...orderStatuses.map((status) => ({ name: status, value: status }))),
    )
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    const status = sanitizeText(interaction.options.getString("status", true), 500);
    const result = await client.container.services.orderService.setOrderStatus(interaction, status);
    const { safeReply } = require("../../utils/discordResponse");
    await safeReply(interaction, {
      content: result.ok ? `Status order diubah ke \`${status}\`.` : result.message,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  },
};
