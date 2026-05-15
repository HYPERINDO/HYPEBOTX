const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createPaymentRejectReasonModal(paymentIdOrTarget = "") {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.modalPaymentRejectReason)
        .setTitle("Reject Payment");

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("payment_reject_reason")
                .setLabel("Alasan Reject Pembayaran (wajib)")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(800),
        ),
    );

    // paymentIdOrTarget sengaja tidak dimasukkan ke payload modal customId karena customId length.
    // Target akan di-pass lewat customId tombol (prefix) dan dipetakan di modalHandler.
    void paymentIdOrTarget;

    return modal;
}

module.exports = {
    createPaymentRejectReasonModal,
};
