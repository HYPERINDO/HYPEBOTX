const { Events } = require("discord.js");

function extractGuildIdFromEventArgs(args = []) {
    for (const arg of args) {
        if (!arg || typeof arg !== "object") {
            continue;
        }

        if (typeof arg.guildId === "string" && arg.guildId) {
            return arg.guildId;
        }

        if (arg.guild && typeof arg.guild.id === "string") {
            return arg.guild.id;
        }

        if (arg.channel && arg.channel.guild && typeof arg.channel.guild.id === "string") {
            return arg.channel.guild.id;
        }

        if (arg.member && arg.member.guild && typeof arg.member.guild.id === "string") {
            return arg.member.guild.id;
        }
    }

    return null;
}

function isGuildAllowed(botConfig = {}, eventName, args = []) {
    const allowedGuildIds = Array.isArray(botConfig.allowedGuildIds)
        ? botConfig.allowedGuildIds
        : [];

    if (allowedGuildIds.length === 0) {
        return true;
    }

    if (eventName === Events.GuildCreate) {
        return true;
    }

    const guildId = extractGuildIdFromEventArgs(args);
    if (!guildId) {
        return true;
    }

    return allowedGuildIds.includes(guildId);
}

module.exports = {
    extractGuildIdFromEventArgs,
    isGuildAllowed,
};
