const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireVerifiedMember } = require("../../middlewares/permissionGuard");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Buka ticket bantuan.")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Jenis ticket")
        .setRequired(false)
        .addChoices(
          { name: "Order", value: "order" },
          { name: "Payment", value: "payment" },
          { name: "Support", value: "support" },
          { name: "Warranty", value: "warranty" },
        ),
    ),
  async execute(interaction, client) {
    if (!(await requireVerifiedMember(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const rawType = sanitizeText(interaction.options.getString("type"), 500) || "support";
    const type = sanitizeText(rawType, 20);
    const { channel, reused } = await client.container.services.ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      type,
      { detail: `Ticket ${type} dari /ticket` },
    );
    await interaction.editReply(reused ? `Kamu masih punya ticket aktif: ${channel}` : `Ticket dibuat: ${channel}`);
  },
};
