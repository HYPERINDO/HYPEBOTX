const { SlashCommandBuilder } = require("discord.js");
const { PANEL_IDS, showPanel } = require("../services/panelService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Buka HYPEBOTX Admin Store Panel."),
  async execute(interaction) {
    return showPanel(interaction, PANEL_IDS.admin);
  },
};
