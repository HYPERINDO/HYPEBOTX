const { SlashCommandBuilder } = require("discord.js");
const { PANEL_IDS, showPanel } = require("../services/panelService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-panel")
    .setDescription("Buka HYPEBOTX Setup Panel."),
  async execute(interaction) {
    return showPanel(interaction, PANEL_IDS.setup);
  },
};
