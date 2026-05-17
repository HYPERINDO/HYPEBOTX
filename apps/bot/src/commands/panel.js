const { SlashCommandBuilder } = require("discord.js");
const { buildHomePayload } = require("../services/panelService");
const { safeReply } = require("../utils/discordResponse");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Buka HYPEBOTX Home Panel sesuai role."),
  async execute(interaction) {
    return safeReply(interaction, buildHomePayload(interaction.member));
  },
};
