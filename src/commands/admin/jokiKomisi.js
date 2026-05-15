const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { createEmbed } = require("../../utils/embed");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joki-komisi")
    .setDescription("Manajemen komisi penjoki")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("add")
        .setDescription("Tambahkan komisi untuk penjoki")
        .addUserOption((option) =>
          option.setName("staff")
            .setDescription("Staff penjoki")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("amount")
            .setDescription("Nominal komisi (misal: 50000)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("order_id")
            .setDescription("Order ID terkait")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("note")
            .setDescription("Catatan (opsional)")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("recap")
        .setDescription("Lihat rekapitulasi komisi")
        .addStringOption((option) =>
          option.setName("month")
            .setDescription("Filter bulan (YYYY-MM, opsional)")
        )
        .addUserOption((option) =>
          option.setName("staff")
            .setDescription("Filter staff (opsional)")
        )
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const backlogService = client.container.services.backlogService;
    if (!backlogService) {
      return interaction.editReply({ content: "Backlog service belum tersedia." });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      const staff = interaction.options.getUser("staff");
      const amount = sanitizeText(interaction.options.getString("amount"), 500);
      const orderId = sanitizeText(interaction.options.getString("order_id"), 500);
      const note = sanitizeText(interaction.options.getString("note"), 500) || "";

      try {
        await backlogService.addJokiCommission({
          guildId: interaction.guildId,
          staffUserId: staff.id,
          orderId,
          amount,
          note,
          actorId: interaction.user.id
        });
        
        await interaction.editReply({ content: `✅ Komisi sebesar Rp${Number(amount).toLocaleString("id-ID")} berhasil ditambahkan untuk <@${staff.id}> (Order: ${orderId}).` });
      } catch (e) {
        await interaction.editReply({ content: `❌ Gagal menambahkan komisi: ${e.message}` });
      }
    } else if (subcommand === "recap") {
      const month = sanitizeText(interaction.options.getString("month"), 500);
      const staff = interaction.options.getUser("staff");
      
      const recap = await backlogService.getJokiCommissionRecap(interaction.guildId, {
        staffUserId: staff?.id,
        month
      });
      
      if (!recap.entries || recap.entries.length === 0) {
        return interaction.editReply({ content: "Belum ada data komisi untuk filter tersebut." });
      }

      const totalFmt = `Rp${recap.totalAmount.toLocaleString("id-ID")}`;
      let description = `**Total Komisi:** ${totalFmt}\n\n**Rincian per Penjoki:**\n`;
      
      for (const group of recap.groupedByStaff) {
        description += `• <@${group.userId}> : Rp${group.amount.toLocaleString("id-ID")}\n`;
      }

      const embed = createEmbed({
        title: `Rekap Komisi Penjoki ${month ? `(${month})` : ""}`,
        description,
        color: 0x2ecc71
      });

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
