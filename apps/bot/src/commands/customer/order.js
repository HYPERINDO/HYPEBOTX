const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { requireVerifiedMember } = require("../../middlewares/permissionGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("order")
    .setDescription("Buka ticket order HYPERINDO.")
    .addStringOption((option) =>
      option.setName("detail").setDescription("Detail singkat order").setRequired(false),
    ),
  async execute(interaction, client) {
    if (!(await requireVerifiedMember(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const detail = sanitizeText(interaction.options.getString("detail"), 500) || "Order dari /order";
    const { channel, reused } = await client.container.services.storeOpsService.openOrderTicket(interaction, detail);
    await interaction.editReply(reused ? `Kamu masih punya ticket aktif: ${channel}` : `Ticket order dibuat: ${channel}`);
  },
};
