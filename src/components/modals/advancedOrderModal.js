const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createDiscordServerModal() {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.discordServerModal)
        .setTitle("FORMAT ORDER JASA SERVER DISCORD");

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
                .setCustomId("server_details")
                .setLabel("Jenis / Tema / Channel / Role")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("JENIS: Gaming/Komunitas/Bisnis | TEMA: ... | CHANNEL: ... | ROLE: ...")
                .setMaxLength(800),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("server_features")
                .setLabel("Bot / Logo Banner / Deadline")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("BOT: Musik/Moderation/Dll | LOGO/BANNER: YA/TIDAK | DEADLINE: ...")
                .setMaxLength(800),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("payment_info")
                .setLabel("Metode Bayar & Total Pembayaran")
                .setRequired(true)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("METODE: ... | TOTAL: Rp ...")
                .setMaxLength(300),
        ),
    );

    return modal;
}

function createBundlePackageModal() {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.bundlePackageModal)
        .setTitle("FORMAT ORDER PAKET BUNDLE");

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
                .setCustomId("bundle_name")
                .setLabel("Nama Paket Bundle yang Dipilih")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Contoh: Bundle Gaming Pro, Bundle Bisnis Lengkap, dll")
                .setMaxLength(300),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("bundle_contents")
                .setLabel("Isi Paket / Game Produk / Request Tambahan")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("ISI: Joki + Akun + Top Up | GAME: ... | REQUEST: ...")
                .setMaxLength(800),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("payment_deadline")
                .setLabel("Deadline & Metode Bayar")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("DEADLINE: ... | METODE: ... | TOTAL: Rp ...")
                .setMaxLength(500),
        ),
    );

    return modal;
}

module.exports = {
    createDiscordServerModal,
    createBundlePackageModal,
};
