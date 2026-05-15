const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("coupon")
    .setDescription("Manajemen Kupon/Voucher Diskon")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Buat kupon baru")
        .addStringOption((opt) => opt.setName("code").setDescription("Kode Kupon (contoh: HYPER10)").setRequired(true))
        .addStringOption((opt) => opt.setName("type").setDescription("Tipe Diskon").setRequired(true).addChoices(
          { name: "Persen (%)", value: "percent" },
          { name: "Nominal (Rp)", value: "nominal" }
        ))
        .addNumberOption((opt) => opt.setName("value").setDescription("Nilai Diskon (contoh: 10 atau 50000)").setRequired(true))
        .addIntegerOption((opt) => opt.setName("limit").setDescription("Batas Pemakaian (Usage Limit)").setRequired(false))
        .addStringOption((opt) => opt.setName("expired").setDescription("Tanggal Expired (YYYY-MM-DD)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Lihat daftar kupon")
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Nonaktifkan kupon")
        .addStringOption((opt) => opt.setName("code").setDescription("Kode Kupon").setRequired(true))
    ),

  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      return interaction.reply({ content: "Akses ditolak.", flags: MessageFlags.Ephemeral });
    }

    const subcommand = interaction.options.getSubcommand();
    const couponRepo = client.container.database.repositories.opsRepository.coupons;
    const guildId = interaction.guildId;

    if (subcommand === "create") {
      const code = sanitizeText(interaction.options.getString("code"), 50);
      const type = sanitizeText(interaction.options.getString("type"), 20);
      const value = interaction.options.getNumber("value");
      const limit = interaction.options.getInteger("limit");
      const expiredStr = sanitizeText(interaction.options.getString("expired"), 30);

      let expiredAt = null;
      if (expiredStr) {
        const date = new Date(expiredStr);
        if (isNaN(date.getTime())) {
          return interaction.reply({ content: "Format tanggal tidak valid. Gunakan YYYY-MM-DD.", flags: MessageFlags.Ephemeral });
        }
        expiredAt = date.toISOString();
      }

      try {
        const all = await couponRepo.getAll();
        const existing = all.find((r) => r.guildId === guildId && r.code.toUpperCase() === code.toUpperCase());
        if (existing) {
          return interaction.reply({ content: `Kupon dengan kode **${code}** sudah ada.`, flags: MessageFlags.Ephemeral });
        }

        await couponRepo.create({
          guildId,
          code: code.toUpperCase(),
          discountType: type,
          discountValue: value,
          usageLimit: limit,
          usageCount: 0,
          expiredAt,
          isActive: true
        });

        await interaction.reply({
          content: `✅ Kupon **${code}** berhasil dibuat!\nDiskon: ${value}${type === "percent" ? "%" : " IDR"}${limit ? `\nLimit: ${limit} kali` : ""}${expiredStr ? `\nExpired: ${expiredStr}` : ""}`,
          flags: MessageFlags.Ephemeral
        });
      } catch (e) {
        await interaction.reply({ content: `Gagal membuat kupon: ${e.message}`, flags: MessageFlags.Ephemeral });
      }
    } else if (subcommand === "list") {
      const coupons = await couponRepo.getAll();
      const activeCoupons = coupons.filter(c => c.guildId === guildId && c.isActive);

      if (!activeCoupons.length) {
        return interaction.reply({ content: "Tidak ada kupon aktif.", flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder().setTitle("🎟️ Daftar Kupon Aktif").setColor("#00FF00");

      const list = activeCoupons.map(c => {
        let desc = `**${c.code}** - ${c.discountType === 'percent' ? c.discountValue + '%' : 'Rp' + c.discountValue}`;
        if (c.usageLimit) desc += ` (Sisa limit: ${c.usageLimit - c.usageCount})`;
        if (c.expiredAt) desc += ` (Exp: ${new Date(c.expiredAt).toLocaleDateString()})`;
        return desc;
      });

      embed.setDescription(list.join("\n"));
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === "disable") {
      const code = sanitizeText(interaction.options.getString("code"), 50);
      const all = await couponRepo.getAll();
      const existing = all.find((r) => r.guildId === guildId && r.code.toUpperCase() === code.toUpperCase());
      if (!existing) {
        return interaction.reply({ content: `Kupon **${code}** tidak ditemukan.`, flags: MessageFlags.Ephemeral });
      }

      await couponRepo.updateById(existing.id, { isActive: false });
      await interaction.reply({ content: `✅ Kupon **${code}** berhasil dinonaktifkan.`, flags: MessageFlags.Ephemeral });
    }
  },
};
