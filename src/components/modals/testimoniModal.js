const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createTestimoniModal() {
  const modal = new ModalBuilder()
    .setCustomId(componentIds.testimoniModal)
    .setTitle("Berikan Testimoni");

  const ratingInput = new TextInputBuilder()
    .setCustomId("rating")
    .setLabel("Rating (1-5)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Beri nilai 1 sampai 5 (misal: 5)")
    .setMinLength(1)
    .setMaxLength(1)
    .setRequired(true);

  const messageInput = new TextInputBuilder()
    .setCustomId("message")
    .setLabel("Pesan Testimoni")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Ceritakan pengalaman Anda...")
    .setMinLength(5)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(ratingInput),
    new ActionRowBuilder().addComponents(messageInput)
  );

  return modal;
}

module.exports = {
  createTestimoniModal,
};
