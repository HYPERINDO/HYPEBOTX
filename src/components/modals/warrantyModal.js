const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createWarrantyModal() {
  const modal = new ModalBuilder()
    .setCustomId(componentIds.warrantyModal)
    .setTitle("Claim Warranty");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("product")
        .setLabel("Produk")
        .setRequired(true)
        .setStyle(TextInputStyle.Short),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("issue")
        .setLabel("Masalah yang dialami")
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph),
    ),
  );

  return modal;
}

module.exports = {
  createWarrantyModal,
};
