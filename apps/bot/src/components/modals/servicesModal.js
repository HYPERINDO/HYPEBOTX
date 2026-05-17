const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../../utils/constants");

function createOptimizerModal() {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.optimizerModal)
        .setTitle("FORMAT ORDER OPTIMIZER WINDOWS");

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
                .setCustomId("device_specs")
                .setLabel("Device / Windows / Spek")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Contoh: PC WINDOWS 11 | Intel i7 | 16GB RAM | RTX 3060 | NVMe")
                .setMaxLength(800),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("optimizer_goals")
                .setLabel("Tujuan & Keluhan Utama")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("TUJUAN: GAMING/STREAMING/EDITING/KERJA | KELUHAN: PC lambat/fps rendah/lag")
                .setMaxLength(800),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("additional_services")
                .setLabel("Layanan Tambahan & Jadwal")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("SETTING OBS/DRIVER/STARTUP: YA/TIDAK | JADWAL: Hari jam berapa | METODE: REMOTE/CHAT")
                .setMaxLength(800),
        ),
    );

    return modal;
}

function createGameAccountModal() {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.gameAccountModal)
        .setTitle("FORMAT ORDER JUAL AKUN GAME");

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
                .setCustomId("game_details")
                .setLabel("Game / Jenis Akun / Paket / Login Via")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("GAME: ... | JENIS: Polosan/Sesuai Paket/Dll | PAKET: ... | LOGIN: Email/ID/Dll")
                .setMaxLength(800),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("account_request")
                .setLabel("Request Khusus & Budget")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("REQUEST KHUSUS: ... | BUDGET: Rp ...")
                .setMaxLength(500),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("payment_info")
                .setLabel("Metode Bayar & Total")
                .setRequired(true)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("METODE: ... | TOTAL: Rp ...")
                .setMaxLength(300),
        ),
    );

    return modal;
}

function createGTAAccountModal() {
    const modal = new ModalBuilder()
        .setCustomId(componentIds.gtaAccountModal)
        .setTitle("FORMAT ORDER AKUN GTA");

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
                .setCustomId("gta_account_type")
                .setLabel("Jenis Akun GTA")
                .setRequired(true)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Service: Akun GTA / Money Service")
                .setMaxLength(100),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("gta_details")
                .setLabel("Platform / Login / Request")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Item: Money Heist 10x | Platform: steam | Versi: legacy | Rockstar ID: ... | Notes: ...")
                .setMaxLength(800),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("budget_payment")
                .setLabel("Budget & Metode Pembayaran")
                .setRequired(true)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Harga: Rp ... | Metode: ...")
                .setMaxLength(300),
        ),
    );

    return modal;
}

module.exports = {
    createOptimizerModal,
    createGameAccountModal,
    createGTAAccountModal,
};
