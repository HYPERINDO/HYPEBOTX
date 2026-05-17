const { randomUUID } = require("crypto");

function getContextFromInteraction(interaction) {
    if (!interaction) return {};

    const guildId = interaction.guild?.id || null;
    const channelId = interaction.channel?.id || null;
    const userId = interaction.user?.id || null;

    // Discord interactions may not always have member (e.g. some DM cases),
    // but this bot mostly expects guild interactions.
    const memberId = interaction.member?.user?.id || null;

    return {
        guildId,
        channelId,
        userId,
        memberId,
        commandName: interaction.commandName || null,
        customId: interaction.customId || null,
        modalId: interaction.customId || null,
        values: interaction.values || null,
        isReplied: Boolean(interaction.replied),
        isDeferred: Boolean(interaction.deferred),
        type:
            interaction.isChatInputCommand?.() ? "chat_input_command" :
                interaction.isButton?.() ? "button" :
                    interaction.isStringSelectMenu?.() ? "string_select_menu" :
                        interaction.isModalSubmit?.() ? "modal" :
                            "interaction",
    };
}

function formatError(error) {
    if (!error) {
        return { message: "Unknown error", stack: null, name: null };
    }

    return {
        name: error.name || "Error",
        message: error.message || String(error),
        stack: error.stack || null,
    };
}

function createFeatureErrorLogger({ logger, loggingService, botConfig }) {
    // correlationId helps you find the same error across multiple logs
    function newCorrelationId() {
        try {
            return randomUUID();
        } catch {
            return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
        }
    }

    async function capture({ interaction, feature, error, correlationId, notifyDiscord = true }) {
        const cid = correlationId || newCorrelationId();
        const err = formatError(error);
        const ctx = getContextFromInteraction(interaction);

        const payload = {
            correlationId: cid,
            feature: feature || "unknown_feature",
            error: { name: err.name, message: err.message },
            context: ctx,
            stack: err.stack,
        };

        // 1) Always log to file/console via existing logger
        logger.error("feature_error_captured", payload);

        // 2) Optionally also send embed to Discord logs
        if (!notifyDiscord) return { correlationId: cid };

        if (loggingService?.logBot) {
            const title = `❗ Feature Error: ${feature || "unknown_feature"}`;
            const description = `Message: \`${err.message}\``;

            const fields = [
                { name: "CorrelationId", value: `\`${cid}\``, inline: false },
                { name: "Type", value: ctx.type || "-", inline: true },
                { name: "Guild", value: ctx.guildId ? `\`${ctx.guildId}\`` : "-", inline: true },
                { name: "Channel", value: ctx.channelId ? `\`${ctx.channelId}\`` : "-", inline: true },
                { name: "User", value: ctx.userId ? `\`${ctx.userId}\`` : "-", inline: true },
                { name: "CustomId/Command", value: ctx.customId || ctx.commandName || "-", inline: false },
                { name: "Stack", value: err.stack ? "```" + err.stack.slice(0, 900) + "```" : "-", inline: false },
            ];

            try {
                await loggingService.logBot(interaction?.guild, title, description, fields);
            } catch (e) {
                logger.error("feature_error_discord_notify_failed", {
                    correlationId: cid,
                    feature: feature || "unknown_feature",
                    error: e?.message || String(e),
                });
            }
        }

        return { correlationId: cid };
    }

    return { capture };
}

module.exports = {
    createFeatureErrorLogger,
};
