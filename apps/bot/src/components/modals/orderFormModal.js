const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createOrderFormModal() {
  const modal = new ModalBuilder()
    .setCustomId(componentIds.orderFormModal)
    .setTitle("FORMAT ORDER JOKI");

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
        .setCustomId("game_info")
        .setLabel("Game / Platform / Login Via / Paket")
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Service: Money Service | Item: Money Heist 10x | Platform: steam | Versi: legacy | Rockstar ID: ...")
        .setMaxLength(800),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("target_deadline")
        .setLabel("Target / Request & Deadline")
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Notes: ... | Deadline: ...")
        .setMaxLength(800),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("payment_note")
        .setLabel("Metode Bayar & Catatan Tambahan")
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Harga: Rp 25.000 | Metode: login | Catatan: ...")
        .setMaxLength(800),
    ),
  );

  return modal;
}

module.exports = {
  createOrderFormModal,
};
