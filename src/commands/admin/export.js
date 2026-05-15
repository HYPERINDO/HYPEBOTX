const { SlashCommandBuilder, MessageFlags, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { createLogger } = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription("Export data ke format CSV")
    .addSubcommand((sub) => sub.setName("orders").setDescription("Export data order"))
    .addSubcommand((sub) => sub.setName("payments").setDescription("Export data payment"))
    .addSubcommand((sub) => sub.setName("joki").setDescription("Export antrean joki"))
    .addSubcommand((sub) => sub.setName("customers").setDescription("Export data pelanggan")),
  async execute(interaction, client) {
    const log = createLogger("export-command");
    if (!isOwnerOrStaff(interaction.member)) {
      return interaction.reply({ content: "Akses ditolak.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    const { orderRepository, paymentRepository, jokiRepository, userRepository } = client.container.database.repositories;
    const guildId = interaction.guildId;

    let data = [];
    let headers = [];
    let filename = "";

    try {
      if (subcommand === "orders") {
        data = await orderRepository.getAll();
        data = data.filter((d) => d.guildId === guildId);
        headers = ["id", "customerId", "product", "sku", "price", "status", "paymentStatus", "createdAt", "updatedAt"];
        filename = "export_orders.csv";
      } else if (subcommand === "payments") {
        data = await paymentRepository.getAll();
        data = data.filter((d) => d.guildId === guildId);
        headers = ["id", "orderId", "customerId", "method", "amount", "status", "createdAt"];
        filename = "export_payments.csv";
      } else if (subcommand === "joki") {
        data = (await jokiRepository.getAll()) || [];
        data = data.filter((d) => d.guildId === guildId);
        headers = ["orderId", "customerId", "status", "workerId", "progress", "createdAt", "updatedAt"];
        filename = "export_joki.csv";
      } else if (subcommand === "customers") {
        data = await userRepository.getAll();
        data = data.filter((d) => d.guildId === guildId);
        headers = ["userId", "username", "tier", "totalOrder", "status", "updatedAt"];
        filename = "export_customers.csv";
      }

      if (!data || data.length === 0) {
        return interaction.editReply({ content: "Tidak ada data yang ditemukan." });
      }

      // Format to CSV
      const csvRows = [];
      csvRows.push(headers.join(",")); // header

      for (const row of data) {
        const values = headers.map((header) => {
          let val = row[header];
          if (val === undefined || val === null) val = "";
          // Escape quotes
          const strVal = String(val).replace(/"/g, '""');
          // Quote if contains comma, newline, or quote
          if (strVal.includes(",") || strVal.includes("\n") || strVal.includes('"')) {
            return `"${strVal}"`;
          }
          return strVal;
        });
        csvRows.push(values.join(","));
      }

      const csvString = csvRows.join("\n");
      const buffer = Buffer.from(csvString, "utf-8");
      const attachment = new AttachmentBuilder(buffer, { name: filename });

      await interaction.editReply({
        content: `✅ Export data **${subcommand}** berhasil (${data.length} baris).`,
        files: [attachment],
      });
    } catch (error) {
      log.error("Export failed", { error: error.message, subcommand });
      await interaction.editReply({ content: "Gagal mengekspor data. Cek log console." });
    }
  },
};
