const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addorder")
    .setDescription("Tambah order manual.")
    .addUserOption((option) => option.setName("customer").setDescription("Customer").setRequired(true))
    .addStringOption((option) => option.setName("produk").setDescription("Game/produk").setRequired(true))
    .addStringOption((option) => option.setName("harga").setDescription("Harga").setRequired(false))
    .addStringOption((option) => option.setName("detail").setDescription("Detail order").setRequired(false)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa tambah order.", flags: MessageFlags.Ephemeral });
      return;
    }
    const customer = interaction.options.getUser("customer", true);
    const rawProduct = sanitizeText(interaction.options.getString("produk", true), 500);
    const rawPrice = sanitizeText(interaction.options.getString("harga"), 500) || "";
    const rawDetail = sanitizeText(interaction.options.getString("detail"), 500) || "";
    const product = sanitizeText(rawProduct, 100);
    const price = sanitizeText(rawPrice, 50);
    const detail = sanitizeText(rawDetail, 500);
    const order = await client.container.services.storeOpsService.addManualOrder(interaction, customer, product, price, detail);
    await interaction.reply({ content: `Order manual dibuat: \`${order.id}\`.`, flags: MessageFlags.Ephemeral });
  },
};
