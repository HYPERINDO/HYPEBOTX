const { EmbedBuilder, MessageFlags } = require("discord.js");
const { safeReply } = require("../utils/discordResponse.js");

/**
 * Guild Whitelist Middleware
 * Validates that commands are executed in whitelisted guilds
 */
function createGuildWhitelistMiddleware(guildWhitelistService, logger) {
    return async (interaction) => {
        if (!interaction.guild) {
            return { allowed: false, reason: "Command can only be used in a server" };
        }

        const isWhitelisted = await guildWhitelistService.isGuildWhitelisted(interaction.guild.id);

        if (!isWhitelisted) {
            // Log the unauthorized attempt
            await guildWhitelistService.logUnauthorizedAccess(
                interaction.guild.id,
                interaction.user.id,
                `Command: ${interaction.commandName}`
            );

            // Prepare error embed
            const embed = new EmbedBuilder()
                .setColor("#FF0000")
                .setTitle("❌ Unauthorized Server")
                .setDescription(
                    "This server is not authorized to use this bot.\n\n" +
                    "If you believe this is an error, please contact the bot administrator."
                )
                .setTimestamp();

            logger?.warn("[WHITELIST] Blocked unauthorized command execution", {
                guildId: interaction.guild.id,
                userId: interaction.user.id,
                command: interaction.commandName,
            });

            return {
                allowed: false,
                reason: "Server not whitelisted",
                embed,
            };
        }

        return { allowed: true };
    };
}

/**
 * Apply guild whitelist check to interaction
 */
async function checkGuildWhitelist(interaction, guildWhitelistService, logger) {
    const middleware = createGuildWhitelistMiddleware(guildWhitelistService, logger);
    const result = await middleware(interaction);

    if (!result.allowed) {
        try {
            await safeReply(interaction, {
                embeds: result.embed ? [result.embed] : [],
                content: result.embed ? null : result.reason,
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger?.error("[WHITELIST] Failed to send unauthorized response", { error: error.message });
        }
        return false;
    }

    return true;
}

module.exports = {
    createGuildWhitelistMiddleware,
    checkGuildWhitelist,
};
