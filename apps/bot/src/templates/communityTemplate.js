const { ChannelType } = require("discord.js");

module.exports = {
  key: "community",
  label: "Komunitas Ringan",
  categories: [
    {
      name: "INFO",
      channels: [
        { type: ChannelType.GuildText, name: "welcome", visibility: "verify", writableBy: "readonly", topic: "Welcome." },
        { type: ChannelType.GuildText, name: "rules", visibility: "verify", writableBy: "readonly", topic: "Rules." },
        { type: ChannelType.GuildText, name: "role-select", visibility: "member", writableBy: "readonly", topic: "Self role." },
        { type: ChannelType.GuildText, name: "verify", visibility: "verify", writableBy: "readonly", topic: "Verify panel." },
      ],
    },
    {
      name: "COMMUNITY",
      channels: [
        { type: ChannelType.GuildText, name: "general-chat", visibility: "member", writableBy: "member", topic: "Chat utama." },
        { type: ChannelType.GuildText, name: "bot-games", visibility: "member", writableBy: "member", topic: "Hiburan." },
        { type: ChannelType.GuildText, name: "giveaway", visibility: "member", writableBy: "member", topic: "Giveaway." },
        { type: ChannelType.GuildVoice, name: "Public Voice", visibility: "member" },
      ],
    },
  ],
};
