const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { createEmbed } = require("../../utils/embed");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("customer-profile")
    .setDescription("Lihat profil lengkap customer.")
    .setDefaultMemberPermissions(staffCommand)
    .addUserOption((option) =>
      option.setName("user").setDescription("Customer yang ingin dilihat profilnya.").setRequired(true),
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser("user", true);
    const guildId = interaction.guild.id;
    const { repositories } = client.container;

    const profile = await repositories.userRepository.find(guildId, target.id);
    const orders = await repositories.orderRepository.findByUserId(guildId, target.id);

    const recentOrders = orders
      .slice(-5)
      .reverse()
      .map((o) => `\`${o.id}\` — ${o.product || "-"} (${o.status})`)
      .join("\n") || "Belum ada order.";

    const tierEmoji = { new: "🆕", regular: "⭐", vip: "👑" };
    const statusEmoji = { normal: "✅", blacklist: "🚫", vip: "👑" };
    const tier = profile?.tier || "new";
    const status = profile?.status || "normal";

    const embed = createEmbed({
      title: `Customer Profile — ${target.tag || target.username}`,
      color: status === "blacklist" ? 0xe74c3c : tier === "vip" ? 0xf1c40f : 0x3498db,
      fields: [
        { name: "User", value: `<@${target.id}>`, inline: true },
        { name: "Status", value: `${statusEmoji[status] || "❓"} ${status}`, inline: true },
        { name: "Tier", value: `${tierEmoji[tier] || "❓"} ${tier}`, inline: true },
        { name: "Total Order", value: String(profile?.totalOrder || 0), inline: true },
        { name: "Total Spent", value: profile?.totalSpent ? `Rp ${profile.totalSpent}` : "-", inline: true },
        { name: "Last Order", value: profile?.lastOrderAt ? `<t:${Math.floor(new Date(profile.lastOrderAt).getTime() / 1000)}:R>` : "-", inline: true },
        { name: "Warranty", value: String(profile?.warrantyCount || 0), inline: true },
        { name: "Dispute", value: String(profile?.disputeCount || 0), inline: true },
        { name: "Refund", value: String(profile?.refundCount || 0), inline: true },
        { name: "Recent Orders", value: recentOrders, inline: false },
        { name: "Blacklist Reason", value: profile?.blacklistReason || "-", inline: false },
        { name: "Notes", value: profile?.notes || "-", inline: false },
      ],
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
