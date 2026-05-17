const { SlashCommandBuilder } = require("discord.js");
const { PANEL_IDS, showPanel } = require("../services/panelService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sync-panel")
    .setDescription("Buka Command Sync dari DevOps Panel."),
  async execute(interaction) {
    return showPanel(interaction, PANEL_IDS.dev);
  },
};
