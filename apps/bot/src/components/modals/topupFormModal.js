const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createTopupFormModal() {
  const modal = new ModalBuilder()
    .setCustomId(componentIds.topupFormModal)
    .setTitle("FORMAT ORDER TOP UP");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("customer_name")
        .setLabel("Nama Customer")
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("whatsapp")
        .setLabel("Nomor WhatsApp")
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(30),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("topup_identity")
        .setLabel("Game / Nickname / User ID / Server ID")
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("GAME: ... | NICKNAME GAME: ... | USER ID: ... | SERVER ID: ...")
        .setMaxLength(1000),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("topup_package")
        .setLabel("Paket Top Up / Jumlah / Catatan")
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("PAKET/NOMINAL: ... | JUMLAH ORDER: ... | CATATAN TAMBAHAN: ...")
        .setMaxLength(1000),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("topup_payment")
        .setLabel("Payment (Metode / Total / Bukti)")
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("METODE: ... | TOTAL: ... | BUKTI TRANSFER: ...")
        .setMaxLength(1000),
    ),
  );

  return modal;
}

module.exports = {
  createTopupFormModal,
};
