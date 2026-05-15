const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setpayment")
    .setDescription("Simpan instruksi payment store.")
    .addStringOption((option) =>
      option
        .setName("tipe")
        .setDescription("Tipe payment")
        .setRequired(true)
        .addChoices(
          { name: "Bank", value: "bank" },
          { name: "E-Wallet", value: "ewallet" },
          { name: "QRIS", value: "qris" },
        ),
    )
    .addStringOption((option) => option.setName("value").setDescription("Instruksi payment").setRequired(true)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa set payment.", flags: MessageFlags.Ephemeral });
      return;
    }
    const settings = await client.container.services.storeOpsService.setPayment(
      interaction,
      sanitizeText(interaction.options.getString("tipe", true), 500),
      sanitizeText(interaction.options.getString("value", true), 500),
    );
    await interaction.reply({ content: `Payment setting tersimpan. Updated: ${settings.updatedAt}`, flags: MessageFlags.Ephemeral });
  },
};
