const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createWarrantyNeedProofReasonModal(ticketIdOrTarget = "") {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.modalWarrantyNeedProofReason)
        .setTitle("Need More Proof - Warranty");

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("warranty_needproof_reason")
                .setLabel("Catatan/bukti yang perlu ditambahkan (wajib)")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(800),
        ),
    );

    // ticketIdOrTarget sengaja tidak dimasukkan ke customId modal.
    // Target akan dipetakan dari customId tombol (prefix) yang memanggil modal.
    void ticketIdOrTarget;

    return modal;
}

module.exports = {
    createWarrantyNeedProofReasonModal,
};
