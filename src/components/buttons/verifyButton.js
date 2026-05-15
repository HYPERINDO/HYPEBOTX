const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createVerifyButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(componentIds.verifyButton)
      .setLabel("Verify Sekarang")
      .setStyle(ButtonStyle.Success),
  );
}

module.exports = {
  createVerifyButtonRow,
};
