const { SlashCommandBuilder, MessageFlags, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("health")
    .setDescription("Menampilkan status health check sistem HYPEBOTX"),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      return interaction.reply({ content: "Akses ditolak.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { database, jobs } = client.container;
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setTitle("🩺 HYPEBOTX System Health Check")
      .setColor("#00FF00")
      .setTimestamp();

    // 1. Database Check
    let dbStatus = "❌ Error";
    try {
      const users = await database.repositories.userRepository.getAll();
      dbStatus = `✅ OK (${users.length} users)`;
    } catch (e) {
      dbStatus = `❌ Fail: ${e.message}`;
    }

    // 2. Command Sync
    const commandsCount = client.commands?.size || 0;
    const commandStatus = commandsCount > 0 ? `✅ OK (${commandsCount} commands)` : "❌ Not Loaded";

    // 3. Permission Bot
    const botMember = guild.members.me;
    const hasAdmin = botMember.permissions.has(PermissionFlagsBits.Administrator);
    const permStatus = hasAdmin ? "✅ Admin OK" : "⚠️ Warning: No Admin Perms";

    // 4. Job Scheduler
    const activeJobs = jobs ? jobs.filter((j) => j && typeof j.stop === "function").length : 0;
    const jobStatus = activeJobs > 0 ? `✅ OK (${activeJobs} active jobs)` : "⚠️ No Jobs Running";

    // 5. Stock Repository
    let stockStatus = "❌ Error";
    try {
      const stocks = await database.repositories.stockRepository.getAll();
      stockStatus = `✅ OK (${stocks.length} stock items)`;
    } catch (e) {
      stockStatus = `❌ Fail: ${e.message}`;
    }

    // 6. Payment & Order Health
    let orderStatus = "❌ Error";
    try {
      const orders = await database.repositories.orderRepository.getAll();
      const payments = await database.repositories.paymentRepository.getAll();
      orderStatus = `✅ OK (${orders.length} orders, ${payments.length} payments)`;
    } catch (e) {
      orderStatus = `❌ Fail: ${e.message}`;
    }

    // 7. Channel Log / Queue (Basic Check)
    // Asumsikan struktur menggunakan `client.container.services.loggingService`
    const loggingService = client.container.services.loggingService;
    const logStatus = loggingService ? "✅ Log Service Ready" : "❌ Log Service Not Found";

    embed.addFields(
      { name: "Database", value: dbStatus, inline: true },
      { name: "Commands", value: commandStatus, inline: true },
      { name: "Bot Permissions", value: permStatus, inline: true },
      { name: "Job Scheduler", value: jobStatus, inline: true },
      { name: "Stock Repository", value: stockStatus, inline: true },
      { name: "Orders & Payments", value: orderStatus, inline: true },
      { name: "Logging / Channels", value: logStatus, inline: true }
    );

    embed.setFooter({ text: "HYPEBOTX Diagnostic Tool" });

    await interaction.editReply({ embeds: [embed] });
  },
};
