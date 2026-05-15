# 📋 HYPERINDO TICKETING FORMAT SYSTEM

## Overview
Sistem format order ticketing HYPERINDO yang komprehensif untuk mengelola berbagai jenis layanan dan order dari customer.

## Format Jenis yang Tersedia

### 1. **FORMAT ORDER JOKI** (`joki`)
- **Deskripsi**: Layanan joki game untuk berbagai platform
- **Isi Utama**: Data customer, detail joki, data akun, payment info
- **Field Wajib**: nama, discord_username, whatsapp, game, platform, login_via, paket, target, deadline, payment_method, total_payment
- **Komponen Modal**: `orderFormModal`
- **Button Custom ID**: `format:joki`

### 2. **FORMAT ORDER TOP UP** (`topup`)
- **Deskripsi**: Layanan top up game item/currency
- **Isi Utama**: Data customer, detail top up, payment info
- **Field Wajib**: nama, discord_username, whatsapp, game, nickname, user_id, server_id, nominal, quantity, payment_method, total_payment
- **Komponen Modal**: `topupFormModal`
- **Button Custom ID**: `format:topup`

### 3. **FORMAT ORDER WINDOWS LICENSE** (`windows`)
- **Deskripsi**: Pembelian lisensi Windows 10/11
- **Isi Utama**: Data customer, detail Windows, info aktivasi, payment
- **Field Wajib**: nama, discord_username, whatsapp, produk, edisi, jumlah_lisensi, device_count, windows_status, payment_method, total_payment
- **Komponen Modal**: `windowsLicenseModal` (dari `licensesModal.js`)
- **Button Custom ID**: `format:windows`

### 4. **FORMAT ORDER OFFICE KEY** (`office`)
- **Deskripsi**: Pembelian lisensi Microsoft Office
- **Isi Utama**: Data customer, detail Office, device info, payment
- **Field Wajib**: nama, discord_username, whatsapp, produk, jumlah_lisensi, device_count, payment_method, total_payment
- **Komponen Modal**: `officeLicenseModal` (dari `licensesModal.js`)
- **Button Custom ID**: `format:office`

### 5. **FORMAT ORDER OPTIMIZER WINDOWS** (`optimizer`)
- **Deskripsi**: Layanan optimasi dan tuning PC/Laptop
- **Isi Utama**: Spesifikasi device, tujuan optimizer, layanan tambahan, jadwal, payment
- **Field Wajib**: nama, discord_username, whatsapp, device_type, windows_version, processor, ram, vga, storage_type, keluhan, tujuan, jadwal, metode, payment_method, total_payment
- **Komponen Modal**: `optimizerModal` (dari `servicesModal.js`)
- **Button Custom ID**: `format:optimizer`

### 6. **FORMAT ORDER JUAL AKUN GAME** (`gameAccount`)
- **Deskripsi**: Penjualan akun game dengan berbagai paket
- **Isi Utama**: Data customer, detail akun, request khusus, budget, payment
- **Field Wajib**: nama, discord_username, whatsapp, game, jenis_akun, paket, login_via, budget, payment_method, total_payment
- **Komponen Modal**: `gameAccountModal` (dari `servicesModal.js`)
- **Button Custom ID**: `format:gameaccount`

### 7. **FORMAT ORDER AKUN GTA** (`gta`)
- **Deskripsi**: Penjualan akun GTA dengan berbagai jenis
- **Isi Utama**: Data customer, jenis akun, platform, request items, budget, payment
- **Field Wajib**: nama, discord_username, whatsapp, jenis_akun, platform, login_via, budget, payment_method, total_payment
- **Komponen Modal**: `gtaAccountModal` (dari `servicesModal.js`)
- **Button Custom ID**: `format:gta`

### 8. **FORMAT ORDER JASA SERVER DISCORD** (`discordServer`)
- **Deskripsi**: Layanan setup dan kustomisasi Discord server
- **Isi Utama**: Data customer, detail server, fitur yang diinginkan, deadline, payment
- **Field Wajib**: nama, discord_username, whatsapp, jenis_server, tema, channel_count, role_count, deadline, payment_method, total_payment
- **Komponen Modal**: `discordServerModal` (dari `advancedOrderModal.js`)
- **Button Custom ID**: `format:discord`

### 9. **FORMAT ORDER PAKET BUNDLE** (`bundle`)
- **Deskripsi**: Paket bundel yang menggabungkan berbagai layanan
- **Isi Utama**: Data customer, detail bundle, isi paket, deadline, payment
- **Field Wajib**: nama, discord_username, whatsapp, paket_bundle, isi_paket, game_produk, deadline, payment_method, total_payment
- **Komponen Modal**: `bundlePackageModal` (dari `advancedOrderModal.js`)
- **Button Custom ID**: `format:bundle`

### 10. **FORMAT CLAIM GARANSI / KOMPLAIN** (`warranty`)
- **Deskripsi**: Klaim garansi dan laporan keluhan terhadap layanan
- **Isi Utama**: Data customer, detail order, detail masalah, bukti, solusi yang diharapkan
- **Field Wajib**: nama, discord_username, whatsapp, layanan, tanggal_order, masalah, request_solusi
- **Komponen Modal**: `warrantyModal` (dari `warrantyModal.js`)
- **Button Custom ID**: `format:warranty`

## File Structure

### Template Definitions
```
src/templates/orderFormats.js
├── orderFormats (object) - Dictionary dari semua format
├── getFormatTemplate(type) - Dapatkan template berdasarkan type
├── getAllFormats() - Dapatkan list semua format
└── getFormatByName(name) - Cari format berdasarkan nama
```

### Modal Components
```
src/components/modals/
├── orderFormModal.js - Modal untuk Joki order
├── topupFormModal.js - Modal untuk Top Up order
├── paymentProofModal.js - Modal untuk bukti pembayaran
├── licensesModal.js - Modal untuk Windows & Office licenses
├── servicesModal.js - Modal untuk Optimizer, Game Account, GTA Account
├── advancedOrderModal.js - Modal untuk Discord Server dan Bundle
└── warrantyModal.js - Modal untuk warranty claim
```

### Utilities
```
src/utils/orderFormatHelper.js
├── createOrderFormatEmbed(formatType) - Buat embed format
├── createOrderFormatListEmbed() - Buat embed list semua format
├── createOrderFormatButtonRows() - Buat button rows untuk format
├── sendOrderFormatMessage(channel, formatType) - Kirim format ke channel
└── sendOrderFormatPanel(channel) - Kirim panel semua format dengan buttons
```

### Button Components
```
src/components/buttons/ticketButton.js
├── createTicketQuickActionRow() - Tombol cepat untuk ticket
├── createOrderTicketRow() - Tombol order ticket
└── createOrderFlowActionRow() - Tombol flow order
```

## Implementation Guide

### 1. Menampilkan Format Order
```javascript
const { sendOrderFormatPanel } = require("../utils/orderFormatHelper");

// Di dalam event atau command handler
await sendOrderFormatPanel(channel);
```

### 2. Menampilkan Format Spesifik
```javascript
const { sendOrderFormatMessage } = require("../utils/orderFormatHelper");

// Menampilkan format Joki
await sendOrderFormatMessage(channel, "joki");

// Menampilkan format Top Up
await sendOrderFormatMessage(channel, "topup");
```

### 3. Mengakses Template Format
```javascript
const { getFormatTemplate } = require("../templates/orderFormats");

const jokiFormat = getFormatTemplate("joki");
console.log(jokiFormat.name); // "FORMAT ORDER JOKI"
console.log(jokiFormat.format); // Template lengkap
console.log(jokiFormat.fields); // Field yang harus diisi
```

### 4. List Semua Format
```javascript
const { getAllFormats } = require("../templates/orderFormats");

const allFormats = getAllFormats();
allFormats.forEach(format => {
  console.log(format.id, format.name, format.description);
});
```

### 5. Cari Format Berdasarkan Nama
```javascript
const { getFormatByName } = require("../templates/orderFormats");

const formatId = getFormatByName("windows");
// Returns: "windows"
```

## Component IDs

Pastikan `componentIds` di `src/utils/constants.js` mencakup:

```javascript
const componentIds = {
  // Existing
  orderFormModal: "modal:order-form",
  topupFormModal: "modal:topup-form",
  orderFormButton: "order:form",
  topupFormButton: "topup:form",
  paymentProofButton: "payment:proof",
  paymentProofModal: "modal:payment-proof",
  warrantyButton: "warranty:form",
  warrantyModal: "modal:warranty-form",
  
  // New
  windowsLicenseModal: "modal:windows-license",
  officeLicenseModal: "modal:office-license",
  optimizerModal: "modal:optimizer",
  gameAccountModal: "modal:game-account",
  gtaAccountModal: "modal:gta-account",
  discordServerModal: "modal:discord-server",
  bundlePackageModal: "modal:bundle-package",
  
  // Format buttons
  formatJoki: "format:joki",
  formatTopup: "format:topup",
  formatWindows: "format:windows",
  formatOffice: "format:office",
  formatOptimizer: "format:optimizer",
  formatGameaccount: "format:gameaccount",
  formatGta: "format:gta",
  formatDiscord: "format:discord",
  formatBundle: "format:bundle",
  formatWarranty: "format:warranty",
};
```

## Best Practices

1. **Selalu Validasi Input**: Gunakan helper functions untuk validasi data form
2. **Store Format Data**: Simpan responses modal ke database ticket metadata
3. **Consistent Naming**: Gunakan naming convention yang konsisten untuk custom IDs
4. **Error Handling**: Tangani error saat modal submission gagal
5. **Logging**: Log setiap format yang dipilih untuk audit trail

## Integrasi dengan Ticket System

### Di Ticket Creation
```javascript
// Ketika ticket dibuat dengan type "order"
const isOrderTicket = ticket.type === "order";
if (isOrderTicket) {
  // Tampilkan panel format order
  await channel.send({
    embeds: [createOrderFormatListEmbed()],
    components: createOrderFormatButtonRows(),
  });
}
```

### Di Modal Handler
```javascript
// Ketika customer submit form
async function handleOrderFormSubmit(interaction) {
  const formData = {
    name: interaction.fields.getTextInputValue("customer_name"),
    whatsapp: interaction.fields.getTextInputValue("whatsapp"),
    gameInfo: interaction.fields.getTextInputValue("game_info"),
    targetDeadline: interaction.fields.getTextInputValue("target_deadline"),
    paymentNote: interaction.fields.getTextInputValue("payment_note"),
  };
  
  // Store ke database
  await repositories.ticketRepository.update(ticketId, {
    meta: {
      ...ticket.meta,
      orderData: formData,
    },
  });
}
```

## Migration Notes

- File existing `orderFormModal.js` dan `topupFormModal.js` tetap digunakan
- File baru hanya menambah pilihan format yang lebih lengkap
- Tidak ada breaking changes ke sistem existing
- Backward compatible dengan sistem ticketing saat ini

## Support Formats

Semua format tersimpan dalam format markdown yang bisa langsung dikopy ke:
- Discord ticket
- Transcript
- Database
- Export/archival

---

**Last Updated**: May 11, 2026
**Version**: 1.0
