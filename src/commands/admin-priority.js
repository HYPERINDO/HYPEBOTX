const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { sanitizeText } = require("../utils/validators");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("admin-priority")
        .setDescription("Manage production hardening features")
        .setDefaultMemberPermissions(0) // Only admins
        .addSubcommand((sub) =>
            sub
                .setName("whitelist-add")
                .setDescription("Add server to whitelist")
                .addStringOption((opt) =>
                    opt
                        .setName("guild_id")
                        .setDescription("Server ID to whitelist")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("whitelist-remove")
                .setDescription("Remove server from whitelist")
                .addStringOption((opt) =>
                    opt
                        .setName("guild_id")
                        .setDescription("Server ID to remove")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("whitelist-list")
                .setDescription("List whitelisted servers")
        )
        .addSubcommand((sub) =>
            sub
                .setName("backup-create")
                .setDescription("Create emergency backup")
        )
        .addSubcommand((sub) =>
            sub
                .setName("backup-list")
                .setDescription("List available backups")
        )
        .addSubcommand((sub) =>
            sub
                .setName("backup-restore")
                .setDescription("Restore from backup")
                .addStringOption((opt) =>
                    opt
                        .setName("filename")
                        .setDescription("Backup filename")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("health-check")
                .setDescription("Bot health status")
        )
        .addSubcommand((sub) =>
            sub
                .setName("spam-stats")
                .setDescription("View spam detection stats")
        )
        .addSubcommand((sub) =>
            sub
                .setName("recovery-status")
                .setDescription("Check JSON corruption recovery status")
        )
        .addSubcommand((sub) =>
            sub
                .setName("recovery-scan")
                .setDescription("Scan for corrupted files")
        )
        .addSubcommand((sub) =>
            sub
                .setName("migration-status")
                .setDescription("View migration status")
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { services, logger } = interaction.client.container;

        // Check if user is admin
        if (!interaction.member.permissions.has("Administrator")) {
            return interaction.reply({
                content: "❌ You need Administrator permission",
                ephemeral: true,
            });
        }

        try {
            switch (subcommand) {
                case "whitelist-add": {
                    const guildId = sanitizeText(interaction.options.getString("guild_id"), 50);
                    await services.guildWhitelistService.addGuildToWhitelist(guildId);

                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#00FF00")
                                .setTitle("✅ Server Added to Whitelist")
                                .addFields({ name: "Guild ID", value: guildId, inline: true })
                                .setTimestamp(),
                        ],
                    });
                }

                case "whitelist-remove": {
                    const guildId = sanitizeText(interaction.options.getString("guild_id"), 50);
                    await services.guildWhitelistService.removeGuildFromWhitelist(guildId);

                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#FF0000")
                                .setTitle("✅ Server Removed from Whitelist")
                                .addFields({ name: "Guild ID", value: guildId, inline: true })
                                .setTimestamp(),
                        ],
                    });
                }

                case "whitelist-list": {
                    const whitelisted = services.guildWhitelistService.getWhitelistedGuildIds();
                    const embed = new EmbedBuilder()
                        .setColor("#0099FF")
                        .setTitle("📋 Whitelisted Servers")
                        .setDescription(whitelisted.length > 0 ? whitelisted.join("\n") : "No servers whitelisted")
                        .setFooter({ text: `Total: ${whitelisted.length}` })
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed] });
                }

                case "backup-create": {
                    await interaction.deferReply();
                    const result = await services.enhancedBackupService.createBackup();

                    const embed = new EmbedBuilder()
                        .setColor(result.success ? "#00FF00" : "#FF0000")
                        .setTitle(result.success ? "✅ Backup Created" : "❌ Backup Failed")
                        .addFields(
                            { name: "Backup ID", value: result.backupId || "N/A", inline: true },
                            { name: "Filename", value: result.filename || "N/A", inline: true },
                            { name: "Size", value: result.size ? `${(result.size / 1024).toFixed(2)} KB` : "N/A", inline: true }
                        )
                        .setTimestamp();

                    if (!result.success && result.error) {
                        embed.addFields({ name: "Error", value: result.error });
                    }

                    return interaction.editReply({ embeds: [embed] });
                }

                case "backup-list": {
                    const backups = services.enhancedBackupService.listBackups();
                    const backupList = backups
                        .slice(0, 10)
                        .map((b, i) => `${i + 1}. ${b.filename} (${(b.size / 1024).toFixed(2)} KB) - ${new Date(b.created).toLocaleString()}`)
                        .join("\n");

                    const embed = new EmbedBuilder()
                        .setColor("#0099FF")
                        .setTitle("📦 Available Backups")
                        .setDescription(backupList || "No backups available")
                        .setFooter({ text: `Total: ${backups.length}` })
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed] });
                }

                case "backup-restore": {
                    await interaction.deferReply();
                    const filename = sanitizeText(interaction.options.getString("filename"), 200);
                    const result = await services.enhancedBackupService.restoreFromBackup(filename);

                    const embed = new EmbedBuilder()
                        .setColor(result.success ? "#00FF00" : "#FF0000")
                        .setTitle(result.success ? "✅ Restore Complete" : "❌ Restore Failed")
                        .addFields(
                            { name: "Backup", value: filename, inline: true },
                            { name: "Status", value: result.success ? "Restored" : "Failed", inline: true }
                        )
                        .setTimestamp();

                    if (!result.success && result.error) {
                        embed.addFields({ name: "Error", value: result.error });
                    }

                    return interaction.editReply({ embeds: [embed] });
                }

                case "health-check": {
                    const health = await services.crashDetectionService.checkBotHealth();

                    const embed = new EmbedBuilder()
                        .setColor(health.healthy ? "#00FF00" : "#FF0000")
                        .setTitle(`🏥 Bot Health: ${health.healthy ? "Healthy" : "At Risk"}`)
                        .addFields(
                            { name: "Memory", value: `${health.checks.memory.value}%`, inline: true },
                            { name: "CPU", value: `${health.checks.cpu.value}%`, inline: true },
                            { name: "Error Rate", value: `${health.checks.errorRate.value}%`, inline: true },
                            { name: "Heartbeat", value: `${health.checks.heartbeat.value}s ago`, inline: true },
                            { name: "Discord", value: health.checks.discord.value, inline: true },
                            { name: "Uptime", value: `${Math.floor(health.uptime / 60)}m`, inline: true }
                        );

                    if (health.alerts.length > 0) {
                        embed.addFields({
                            name: "⚠️ Alerts",
                            value: health.alerts.map(a => `- ${a.type}: ${a.message}`).join("\n"),
                        });
                    }

                    embed.setTimestamp();
                    return interaction.reply({ embeds: [embed] });
                }

                case "spam-stats": {
                    const stats = services.antiSpamService.getSpamStats();

                    const embed = new EmbedBuilder()
                        .setColor("#0099FF")
                        .setTitle("📊 Spam Detection Stats")
                        .addFields({
                            name: "Total Violators",
                            value: stats.totalViolators.toString(),
                            inline: true,
                        });

                    if (stats.topViolators.length > 0) {
                        embed.addFields({
                            name: "Top Violators",
                            value: stats.topViolators
                                .map(v => `<@${v.userId}>: ${v.violations} violations`)
                                .join("\n"),
                        });
                    }

                    embed.setTimestamp();
                    return interaction.reply({ embeds: [embed] });
                }

                case "recovery-status": {
                    const status = services.jsonRecoveryService.getRecoveryStatus();

                    const embed = new EmbedBuilder()
                        .setColor(status.systemHealth === "healthy" ? "#00FF00" : "#FF0000")
                        .setTitle(`🔧 JSON Recovery Status: ${status.systemHealth.toUpperCase()}`)
                        .addFields(
                            { name: "Corrupted Files", value: status.corruptedFiles.toString(), inline: true },
                            { name: "Backups Available", value: status.backupsAvailable.toString(), inline: true }
                        );

                    if (status.details.corrupted.length > 0) {
                        embed.addFields({
                            name: "Affected Files",
                            value: status.details.corrupted.map(f => f.file).join("\n"),
                        });
                    }

                    embed.setTimestamp();
                    return interaction.reply({ embeds: [embed] });
                }

                case "recovery-scan": {
                    await interaction.deferReply();
                    const scan = services.jsonRecoveryService.scanForCorruption();

                    const embed = new EmbedBuilder()
                        .setColor("#0099FF")
                        .setTitle("🔍 Corruption Scan Results")
                        .addFields({
                            name: "Corrupted Files",
                            value: scan.corrupted.length.toString(),
                            inline: true,
                        })
                        .addFields({
                            name: "Backups Found",
                            value: scan.backupsAvailable.toString(),
                            inline: true,
                        });

                    if (scan.corrupted.length > 0) {
                        const corruptedList = scan.corrupted.slice(0, 10).map(c => c.file).join("\n");
                        embed.addFields({
                            name: "Detected Issues",
                            value: corruptedList,
                        });
                    }

                    embed.setTimestamp();
                    return interaction.editReply({ embeds: [embed] });
                }

                case "migration-status": {
                    const status = await services.migrationService.getStatus();

                    const embed = new EmbedBuilder()
                        .setColor("#0099FF")
                        .setTitle("📈 Migration Status")
                        .addFields(
                            { name: "Total Migrations", value: status.totalMigrations.toString(), inline: true },
                            { name: "Executed", value: status.executedMigrations.toString(), inline: true },
                            { name: "Pending", value: status.pendingMigrations.toString(), inline: true }
                        );

                    if (status.lastRun) {
                        embed.addFields({
                            name: "Last Run",
                            value: new Date(status.lastRun).toLocaleString(),
                        });
                    }

                    embed.setTimestamp();
                    return interaction.reply({ embeds: [embed] });
                }

                default:
                    return interaction.reply({ content: "Unknown subcommand", ephemeral: true });
            }
        } catch (error) {
            logger.error("[ADMIN-PRIORITY] Command error", { error: error.message });
            return interaction.reply({
                content: `❌ Error: ${error.message}`,
                ephemeral: true,
            });
        }
    },
};
