# 📋 FORMAT ORDER HYPERINDO - QUICK REFERENCE

## Format Summary Table

| # | Nama Format | ID | Button ID | Modal | Kategori |
|---|---|---|---|---|---|
| 1 | **JOKI** | `joki` | `format:joki` | orderFormModal | Service |
| 2 | **TOP UP** | `topup` | `format:topup` | topupFormModal | Service |
| 3 | **WINDOWS LICENSE** | `windows` | `format:windows` | windowsLicenseModal | Software |
| 4 | **OFFICE LICENSE** | `office` | `format:office` | officeLicenseModal | Software |
| 5 | **PC OPTIMIZER** | `optimizer` | `format:optimizer` | optimizerModal | Service |
| 6 | **GAME ACCOUNT** | `gameAccount` | `format:gameaccount` | gameAccountModal | Account |
| 7 | **GTA ACCOUNT** | `gta` | `format:gta` | gtaAccountModal | Account |
| 8 | **DISCORD SERVER** | `discordServer` | `format:discord` | discordServerModal | Service |
| 9 | **BUNDLE PACKAGE** | `bundle` | `format:bundle` | bundlePackageModal | Package |
| 10 | **WARRANTY CLAIM** | `warranty` | `format:warranty` | warrantyClaimModal | Support |

## Required Fields Checklist

### 🎮 JOKI
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Game
- [x] Platform
- [x] Login Via
- [x] Paket
- [x] Target/Request
- [x] Deadline
- [x] Payment Method
- [x] Total Payment

### 💰 TOP UP
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Game
- [x] Nickname
- [x] User ID
- [x] Server ID
- [x] Nominal
- [x] Quantity
- [x] Payment Method
- [x] Total Payment

### 🪟 WINDOWS LICENSE
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Produk (10/11)
- [x] Edisi (HOME/PRO)
- [x] Jumlah Lisensi
- [x] Device Count
- [x] Windows Status
- [x] Payment Method
- [x] Total Payment

### 📊 OFFICE LICENSE
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Produk (2019/2021/365)
- [x] Jumlah Lisensi
- [x] Device Count
- [x] Payment Method
- [x] Total Payment

### ⚙️ OPTIMIZER
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Device Type
- [x] Windows Version
- [x] Processor
- [x] RAM
- [x] VGA/GPU
- [x] Storage Type
- [x] Keluhan Utama
- [x] Tujuan Optimizer
- [x] Jadwal
- [x] Metode Pengerjaan
- [x] Payment Method
- [x] Total Payment

### 🎯 GAME ACCOUNT
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Game
- [x] Jenis Akun
- [x] Paket
- [x] Login Via
- [x] Budget
- [x] Payment Method
- [x] Total Payment

### 🚗 GTA ACCOUNT
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Jenis Akun (Polosan/Sesuai/Saudara/+Rockstar)
- [x] Platform
- [x] Login Via
- [x] Budget
- [x] Payment Method
- [x] Total Payment

### 💎 DISCORD SERVER
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Jenis Server
- [x] Tema
- [x] Channel Count
- [x] Role Count
- [x] Deadline
- [x] Payment Method
- [x] Total Payment

### 📦 BUNDLE PACKAGE
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Bundle Name
- [x] Isi Paket
- [x] Game/Produk
- [x] Deadline
- [x] Payment Method
- [x] Total Payment

### 🛡️ WARRANTY CLAIM
- [x] Nama
- [x] Discord Username
- [x] WhatsApp
- [x] Layanan Dibeli
- [x] Tanggal Order
- [x] Masalah/Keluhan
- [x] Request Solusi

## File Structure Reference

```
bot/
├── src/
│   ├── templates/
│   │   └── orderFormats.js ⭐ (Main templates)
│   ├── components/
│   │   └── modals/
│   │       ├── orderFormModal.js (Existing - JOKI)
│   │       ├── topupFormModal.js (Existing - TOP UP)
│   │       ├── licensesModal.js ⭐ (NEW - WINDOWS/OFFICE)
│   │       ├── servicesModal.js ⭐ (NEW - OPTIMIZER/ACCOUNTS)
│   │       └── advancedOrderModal.js ⭐ (NEW - DISCORD/BUNDLE/WARRANTY)
│   ├── utils/
│   │   ├── constants.js (UPDATED - New component IDs)
│   │   └── orderFormatHelper.js ⭐ (NEW - Helpers)
│   └── handlers/
│       ├── buttonHandler.js (NEEDS UPDATE)
│       └── modalHandler.js (NEEDS UPDATE)
├── docs/
│   ├── TICKETING_FORMAT_GUIDE.md ⭐ (NEW - Full guide)
│   └── IMPLEMENTATION_GUIDE.md ⭐ (NEW - Integration steps)
```

## Component IDs Reference

### Modals
```
modal:order-form
modal:topup-form
modal:windows-license
modal:office-license
modal:optimizer
modal:game-account
modal:gta-account
modal:discord-server
modal:bundle-package
modal:warranty-form
modal:payment-proof
```

### Buttons
```
format:joki
format:topup
format:windows
format:office
format:optimizer
format:gameaccount
format:gta
format:discord
format:bundle
format:warranty
```

## Common Patterns

### Get all format templates
```javascript
const { getAllFormats } = require("./src/templates/orderFormats");
```

### Display format as embed
```javascript
const { sendOrderFormatMessage } = require("./src/utils/orderFormatHelper");
await sendOrderFormatMessage(channel, "joki");
```

### Show all formats with buttons
```javascript
const { sendOrderFormatPanel } = require("./src/utils/orderFormatHelper");
await sendOrderFormatPanel(channel);
```

### Get specific template
```javascript
const { getFormatTemplate } = require("./src/templates/orderFormats");
const template = getFormatTemplate("windows");
console.log(template.fields); // Get required fields
```

## Important Notes

🔒 **Security**
- Jangan kirim password/2FA di channel publik
- Hanya kirim data login via private ticket/chat
- Validate semua input sebelum store ke database

✅ **Best Practices**
- Selalu isi semua field yang required
- Pastikan data sudah benar sebelum submit
- Gunakan format yang sesuai dengan jenis layanan
- Screenshot bukti pembayaran dengan jelas

📊 **Database**
- Semua order data disimpan di ticket metadata
- Format: `ticket.meta.orderData`
- Audit trail: `orderData.submittedAt`

🔄 **Workflow**
1. Customer buat ticket
2. Pilih format order
3. Fill form dengan data
4. Submit dan tunggu response
5. Kirim bukti pembayaran
6. Admin verifikasi dan proses

---

**Last Updated**: May 11, 2026
**Status**: Ready for Integration
