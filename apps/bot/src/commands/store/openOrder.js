const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireVerifiedMember } = require("../../middlewares/permissionGuard");
const { sanitizeText, validateInput } = require("../../utils/validators");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("open-order")
    .setDescription("Buka ticket order secara cepat.")
    .addStringOption((option) =>
      option.setName("detail").setDescription("Detail singkat order").setRequired(false),
    ),
  async execute(interaction, client) {
    if (!(await requireVerifiedMember(interaction))) {
      return;
    }

    const rawDetail = sanitizeText(interaction.options.getString("detail"), 500) || "Order baru";
    const validation = validateInput(rawDetail, { maxLength: 240, required: true });
    if (!validation.valid) {
      await safeReply(interaction, {
        content: `[ERROR] Detail order tidak valid: ${validation.errors.join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const detail = sanitizeText(rawDetail, 240);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { channel, reused } = await client.container.services.orderService.openOrder(interaction, detail);
    await interaction.editReply(
      reused ? `Kamu masih punya order aktif di ${channel}.` : `Order ticket berhasil dibuat di ${channel}.`,
    );
  },
};
