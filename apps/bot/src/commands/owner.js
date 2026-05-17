const { SlashCommandBuilder } = require("discord.js");
const { PANEL_IDS, showPanel } = require("../services/panelService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("owner")
    .setDescription("Buka HYPEBOTX Owner Control Center."),
  async execute(interaction) {
    return showPanel(interaction, PANEL_IDS.owner);
  },
};
