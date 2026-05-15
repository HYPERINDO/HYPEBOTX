const { ChannelType } = require("discord.js");

module.exports = {
  key: "basic",
  label: "Basic",
  categories: [
    {
      name: "INFO",
      channels: [
        { type: ChannelType.GuildText, name: "welcome", visibility: "verify", writableBy: "readonly", topic: "Welcome." },
        { type: ChannelType.GuildText, name: "rules", visibility: "verify", writableBy: "readonly", topic: "Rules." },
        { type: ChannelType.GuildText, name: "verify", visibility: "verify", writableBy: "readonly", topic: "Verify panel." },
      ],
    },
    {
      name: "COMMUNITY",
      channels: [
        { type: ChannelType.GuildText, name: "general-chat", visibility: "member", writableBy: "member", topic: "Chat utama." },
        { type: ChannelType.GuildText, name: "media-share", visibility: "member", writableBy: "member", topic: "Share media." },
      ],
    },
    {
      name: "STAFF",
      channels: [
        { type: ChannelType.GuildText, name: "staff-chat", visibility: "staff", writableBy: "staff", topic: "Staff chat." },
        { type: ChannelType.GuildText, name: "bot-log", visibility: "staff", writableBy: "staff", topic: "Bot log." },
      ],
    },
  ],
};
