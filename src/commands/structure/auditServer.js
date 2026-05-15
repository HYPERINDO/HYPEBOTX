const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");
const { sendAuditAsFile } = require("../../utils/discordResponse");

function renderAuditReport(report) {
  const timestamp = new Date().toLocaleString("id-ID");
  const lines = [
    "═".repeat(60),
    "HASIL AUDIT SERVER HYPERINDO",
    "═".repeat(60),
    `Waktu: ${timestamp}`,
    "",
  ];

  // Missing Roles
  if (report.missingRoles.length > 0) {
    lines.push("❌ ROLE YANG HILANG:");
    report.missingRoles.forEach(role => lines.push(`   • ${role}`));
    lines.push("");
  }

  // Duplicate Roles
  if (report.duplicateRoles.length > 0) {
    lines.push("⚠️ ROLE DUPLICATE:");
    report.duplicateRoles.forEach(duplicate => lines.push(`   • ${duplicate.name} ada ${duplicate.count} role`));
    lines.push("");
  }

  // Missing Categories
  if (report.missingCategories.length > 0) {
    lines.push("📁 KATEGORI CHANNEL YANG HILANG:");
    report.missingCategories.forEach(cat => lines.push(`   • ${cat}`));
    lines.push("");
  }

  // Missing Channels
  if (report.missingChannels.length > 0) {
    lines.push("💬 CHANNEL YANG HILANG:");
    report.missingChannels.forEach(ch => lines.push(`   • ${ch}`));
    lines.push("");
  }

  // Missing Log Channels
  if (report.missingLogChannels.length > 0) {
    lines.push("📝 LOG CHANNEL YANG HILANG:");
    report.missingLogChannels.forEach(log => lines.push(`   • ${log}`));
    lines.push("");
  }

  // Empty Categories
  if (report.emptyCategories.length > 0) {
    lines.push("📂 KATEGORI KOSONG:");
    report.emptyCategories.forEach(empty => lines.push(`   • ${empty}`));
    lines.push("");
  }

  // Misplaced Channels
  if (report.misplacedChannels.length > 0) {
    lines.push("🔀 CHANNEL YANG TIDAK DI KATEGORI YANG TEPAT:");
    report.misplacedChannels.forEach(issue => {
      lines.push(`   • ${issue.channel}`);
      lines.push(`     Sekarang   : ${issue.current}`);
      lines.push(`     Seharusnya : ${issue.expected}`);
    });
    lines.push("");
  }

  // Permission Issues
  if (report.permissionIssues.length > 0) {
    lines.push("🔒 MASALAH PERMISSION:");
    report.permissionIssues.forEach(issue => lines.push(`   • ${issue}`));
    lines.push("");
  }

  // Verify Issues
  if (report.verifyIssues.length > 0) {
    lines.push("⚠️ MASALAH VERIFY:");
    report.verifyIssues.forEach(issue => lines.push(`   • ${issue}`));
    lines.push("");
  } else {
    lines.push("✅ VERIFY:");
    lines.push("   • Panel verify sudah aktif.");
    lines.push("");
  }

  // Summary
  const totalIssues = report.missingRoles.length + report.missingCategories.length +
    report.missingChannels.length + report.missingLogChannels.length +
    report.emptyCategories.length + report.misplacedChannels.length +
    report.permissionIssues.length + report.verifyIssues.length + report.duplicateRoles.length;

  lines.push("═".repeat(60));
  if (totalIssues === 0) {
    lines.push("✅ STATUS: Server OK - Tidak ada masalah yang ditemukan");
  } else {
    lines.push(`⚠️  STATUS: Ditemukan ${totalIssues} masalah yang perlu diperbaiki`);
  }
  lines.push("═".repeat(60));

  return lines.join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("audit-server")
    .setDescription("Audit struktur, role, dan permission server.")
    .setDefaultMemberPermissions(adminCommand),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const report = await client.container.services.auditService.auditServer(interaction.guild, "gamestore");

    const auditText = renderAuditReport(report);
    await sendAuditAsFile(interaction, auditText, "audit-server-hyperindo.txt");
  },
};
