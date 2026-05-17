const { createLogger } = require("./logger");
const { createWebhookLogger } = require("./webhookDiscordLogger");

function createDiscordWebhookConsoleLogger({ webhookUrl, scope = "webhook", levels = ["ERROR", "WARN", "INFO"] } = {}) {
    const fileLogger = createLogger(scope);
    const webhookLogger = createWebhookLogger(webhookUrl);
    const enabledLevels = new Set(levels.map((level) => String(level).toUpperCase()));

    async function forward(level, message, extra) {
        if (!enabledLevels.has(level)) {
            return null;
        }

        // IMPORTANT: never forward raw "extra" objects to webhook,
        // because it turns into verbose JSON dumps (url/title/guildId/etc).
        // Keep webhook console logs concise.
        try {
            await webhookLogger.log(message, { level });
        } catch (_) {
            // ignore webhook errors
        }
    }

    return {
        info(message, extra) {
            fileLogger.info(message, extra);
            return forward("INFO", message, extra);
        },
        warn(message, extra) {
            fileLogger.warn(message, extra);
            return forward("WARN", message, extra);
        },
        error(message, extra) {
            fileLogger.error(message, extra);
            return forward("ERROR", message, extra);
        },
    };
}

module.exports = {
    createDiscordWebhookConsoleLogger,
};
