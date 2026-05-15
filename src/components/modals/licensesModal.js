const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createWindowsLicenseModal() {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.windowsLicenseModal)
        .setTitle("FORMAT ORDER WINDOWS LICENSE");

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
                .setCustomId("windows_details")
                .setLabel("Produk / Edisi / Jumlah Lisensi / Device")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("PRODUK: WINDOWS 10/11 | EDISI: HOME/PRO | LISENSI: ... | DEVICE: ...")
                .setMaxLength(500),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("windows_status_activation")
                .setLabel("Status Windows & Aktivasi")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("STATUS WINDOWS SAAT INI: ... | BUTUH BANTU AKTIVASI: YA/TIDAK")
                .setMaxLength(500),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("payment_details")
                .setLabel("Metode Bayar & Catatan")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("METODE PEMBAYARAN: ... | TOTAL BAYAR: ... | CATATAN: ...")
                .setMaxLength(800),
        ),
    );

    return modal;
}

function createOfficeLicenseModal() {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.officeLicenseModal)
        .setTitle("FORMAT ORDER OFFICE KEY");

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
                .setCustomId("office_details")
                .setLabel("Produk / Jumlah Lisensi / Device")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("PRODUK: OFFICE 2019/2021/365 | LISENSI: ... | DEVICE: ...")
                .setMaxLength(500),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("activation_guide")
                .setLabel("Panduan Aktivasi & Catatan")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("BUTUH PANDUAN: YA/TIDAK | CATATAN TAMBAHAN: ...")
                .setMaxLength(500),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("payment_details")
                .setLabel("Metode Bayar & Total Pembayaran")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("METODE PEMBAYARAN: ... | TOTAL BAYAR: ...")
                .setMaxLength(500),
        ),
    );

    return modal;
}

module.exports = {
    createWindowsLicenseModal,
    createOfficeLicenseModal,
};
