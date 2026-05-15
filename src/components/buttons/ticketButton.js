const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createOrderTicketRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(componentIds.orderFormButton)
      .setLabel("ORDER JOKI")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(componentIds.topupFormButton)
      .setLabel("ORDER TOP UP")
      .setStyle(ButtonStyle.Secondary),
  );
}

function createOrderFlowActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(componentIds.paymentProofButton)
      .setLabel("PAYMENT")
      .setStyle(ButtonStyle.Success),
  );
}

module.exports = {
  createOrderTicketRow,
  createOrderFlowActionRow,
};
