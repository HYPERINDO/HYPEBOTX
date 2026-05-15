const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setprice")
    .setDescription("Tambah/update price list.")
    .addStringOption((option) => option.setName("nama").setDescription("Nama paket/produk").setRequired(true))
    .addStringOption((option) => option.setName("harga").setDescription("Harga").setRequired(true))
    .addStringOption((option) => option.setName("deskripsi").setDescription("Deskripsi").setRequired(false))
    .addStringOption((option) => option.setName("category").setDescription("Category (opsional)").setRequired(false))
    .addStringOption((option) => option.setName("sku").setDescription("SKU linked (opsional)").setRequired(false))
    .addStringOption((option) =>
      option
        .setName("active")
        .setDescription("Aktifkan price entry")
        .setRequired(false)
        .addChoices(
          { name: "true", value: "true" },
          { name: "false", value: "false" },
        ),
    )
    .addIntegerOption((option) => option.setName("sort").setDescription("Sort order (default: 0)").setRequired(false)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa set price.", flags: MessageFlags.Ephemeral });
      return;
    }

    const name = sanitizeText(interaction.options.getString("nama", true), 100);
    const price = sanitizeText(interaction.options.getString("harga", true), 50);
    const description = sanitizeText(interaction.options.getString("deskripsi"), 500) || "";
    const category = sanitizeText(interaction.options.getString("category"), 500) || "";
    const sku = sanitizeText(interaction.options.getString("sku"), 500) || null;

    const activeRaw = sanitizeText(interaction.options.getString("active"), 500) || "";
    const isActive = activeRaw ? activeRaw === "true" : true;

    const sortOrder = interaction.options.getInteger("sort") ?? 0;

    const row = await client.container.services.storeOpsService.setPrice(interaction, {
      name,
      price,
      description,
      category,
      sku,
      isActive,
      sortOrder,
    });

    await interaction.reply({
      content: `Price list tersimpan: **${row.name}** - ${row.price}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
