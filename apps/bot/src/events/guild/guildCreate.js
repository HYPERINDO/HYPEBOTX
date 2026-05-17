const { Events } = require("discord.js");

module.exports = {
    name: Events.GuildCreate,
    async execute(client, guild) {
        const allowedGuildIds = Array.isArray(client.container?.botConfig?.allowedGuildIds)
            ? client.container.botConfig.allowedGuildIds
            : [];

        if (allowedGuildIds.length > 0 && !allowedGuildIds.includes(guild.id)) {
            client.container.logger?.warn?.("guild joined but not allowed by ALLOWED_GUILD_IDS, leaving guild", {
                guildId: guild.id,
                guildName: guild.name,
            });

            try {
                await guild.leave();
            } catch (error) {
                client.container.logger?.error?.("failed to leave disallowed guild", {
                    guildId: guild.id,
                    error: error?.message || String(error),
                });
            }
        }
    },
};
