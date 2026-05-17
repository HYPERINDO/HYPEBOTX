const { ButtonBuilder, ButtonStyle } = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createClaimTicketButton() {
  return new ButtonBuilder()
    .setCustomId(componentIds.ticketClaim)
    .setLabel("Claim Ticket")
    .setStyle(ButtonStyle.Primary);
}

module.exports = {
  createClaimTicketButton,
};
