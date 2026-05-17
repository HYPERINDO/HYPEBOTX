const { PermissionFlagsBits } = require("discord.js");

function getAiModeForMessage(message) {
    const channelName = String(message.channel?.name || "").toLowerCase();
    const member = message.member;

    if (member?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
        return "admin";
    }

    if (channelName.includes("ticket")) {
        return "ticket";
    }

    if (channelName.includes("staff") || channelName.includes("support") || channelName.includes("admin")) {
        return "staff";
    }

    return "customer";
}

module.exports = {
    getAiModeForMessage,
};
