const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireVerifiedMember } = require("../../middlewares/permissionGuard");
const { sanitizeText, validateInput } = require("../../utils/validators");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warranty-claim")
    .setDescription("Buka ticket claim warranty.")
    .addStringOption((option) =>
      option.setName("issue").setDescription("Masalah yang dialami").setRequired(false),
    ),
  async execute(interaction, client) {
    if (!(await requireVerifiedMember(interaction))) {
      return;
    }

    const rawIssue = sanitizeText(interaction.options.getString("issue"), 500) || "Claim warranty";
    const validation = validateInput(rawIssue, { maxLength: 500, required: true });
    if (!validation.valid) {
      await safeReply(interaction, {
        content: `[ERROR] Deskripsi issue tidak valid: ${validation.errors.join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const issue = sanitizeText(rawIssue, 500);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await client.container.services.ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      "warranty",
      { issue, source: "command" },
    );
    await interaction.editReply(`Warranty ticket berhasil dibuat di ${result.channel}.`);
  },
};
