const { ButtonBuilder, ButtonStyle } = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createCloseTicketButton() {
  return new ButtonBuilder()
    .setCustomId(componentIds.ticketClose)
    .setLabel("Close Ticket")
    .setStyle(ButtonStyle.Danger);
}

module.exports = {
  createCloseTicketButton,
};
