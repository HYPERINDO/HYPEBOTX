# 🚀 Quick Implementation Guide - Order Format Ticketing

## Overview
Panduan cepat untuk mengintegrasikan sistem format order ke dalam ticketing system HYPERINDO.

## File yang Telah Dibuat

1. **`src/templates/orderFormats.js`** - Semua template format order
2. **`src/components/modals/licensesModal.js`** - Modal untuk Windows & Office licenses
3. **`src/components/modals/servicesModal.js`** - Modal untuk Optimizer, Game Account, GTA
4. **`src/components/modals/advancedOrderModal.js`** - Modal untuk Discord Server, Bundle, Warranty
5. **`src/utils/orderFormatHelper.js`** - Helper utilities untuk menampilkan format
6. **`docs/TICKETING_FORMAT_GUIDE.md`** - Dokumentasi lengkap
7. **`src/utils/constants.js`** - Updated dengan component IDs baru

## Langkah Integrasi

### Step 1: Update Button Handler untuk Format Buttons
Edit `src/handlers/buttonHandler.js` untuk menangani format buttons:

```javascript
const { createOrderFormatEmbed } = require("../utils/orderFormatHelper");
const { 
  createWindowsLicenseModal,
  createOfficeLicenseModal,
} = require("../components/modals/licensesModal");
const {
  createOptimizerModal,
  createGameAccountModal,
  createGTAAccountModal,
} = require("../components/modals/servicesModal");
const {
  createDiscordServerModal,
  createBundlePackageModal,
} = require("../components/modals/advancedOrderModal");
const { createWarrantyModal } = require("../components/modals/warrantyModal");

// Tambahkan di dalam button handler switch statement:
case "format:joki":
  return interaction.showModal(createOrderFormModal());

case "format:topup":
  return interaction.showModal(createTopupFormModal());

case "format:windows":
  return interaction.showModal(createWindowsLicenseModal());

case "format:office":
  return interaction.showModal(createOfficeLicenseModal());

case "format:optimizer":
  return interaction.showModal(createOptimizerModal());

case "format:gameaccount":
  return interaction.showModal(createGameAccountModal());

case "format:gta":
  return interaction.showModal(createGTAAccountModal());

case "format:discord":
  return interaction.showModal(createDiscordServerModal());

case "format:bundle":
  return interaction.showModal(createBundlePackageModal());

case "format:warranty":
  return interaction.showModal(createWarrantyModal());
```

### Step 2: Update Modal Handler
Edit `src/handlers/modalHandler.js` untuk menangani submission dari semua modals:

```javascript
const { componentIds } = require("../utils/constants");
const { repositories } = require("../database");

// Tambahkan handler untuk setiap modal:

async function handleOrderFormSubmit(interaction, modalCustomId) {
  const ticketId = // Extract dari channel topic
  
  const formData = {
    type: "joki",
    submittedAt: new Date().toISOString(),
    data: {
      name: interaction.fields.getTextInputValue("customer_name"),
      whatsapp: interaction.fields.getTextInputValue("whatsapp"),
      gameInfo: interaction.fields.getTextInputValue("game_info"),
      targetDeadline: interaction.fields.getTextInputValue("target_deadline"),
      paymentNote: interaction.fields.getTextInputValue("payment_note"),
    }
  };

  await repositories.ticketRepository.update(ticketId, {
    meta: {
      orderData: formData,
    }
  });

  await interaction.reply({
    content: "✅ Form order berhasil disimpan!",
    ephemeral: true,
  });
}

// Repeat untuk setiap modal type...
```

### Step 3: Tambahkan Command untuk Display Format List
Create `src/commands/setup/formatHelp.js`:

```javascript
const { SlashCommandBuilder } = require("discord.js");
const { sendOrderFormatPanel } = require("../../utils/orderFormatHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("format")
    .setDescription("Tampilkan daftar format order HYPERINDO")
    .addStringOption(option =>
      option
        .setName("type")
        .setDescription("Jenis format yang ingin ditampilkan")
        .setRequired(false)
        .addChoices(
          { name: "Joki", value: "joki" },
          { name: "Top Up", value: "topup" },
          { name: "Windows License", value: "windows" },
          { name: "Office License", value: "office" },
          { name: "PC Optimizer", value: "optimizer" },
          { name: "Game Account", value: "gameAccount" },
          { name: "GTA Account", value: "gta" },
          { name: "Discord Server", value: "discordServer" },
          { name: "Bundle Package", value: "bundle" },
          { name: "Warranty Claim", value: "warranty" },
        )
    ),

  async execute(interaction) {
    const formatType = interaction.options.getString("type");

    if (formatType) {
      const { sendOrderFormatMessage } = require("../../utils/orderFormatHelper");
      await sendOrderFormatMessage(interaction.channel, formatType);
    } else {
      await sendOrderFormatPanel(interaction.channel);
    }

    await interaction.reply({
      content: "✅ Format order berhasil ditampilkan!",
      ephemeral: true,
    });
  },
};
```

### Step 4: Update Ticket Bootstrap Message
Edit `src/services/ticketService.js` - `sendTicketBootstrapMessage()`:

```javascript
async function sendTicketBootstrapMessage(channel, ticket, opener) {
  const staffActionRow = new ActionRowBuilder().addComponents(
    createClaimTicketButton(),
    createCloseTicketButton(),
  );

  const isOrderTicket = ticket.type === "order";
  
  // Import order format helpers
  const { createOrderFormatButtonRows } = require("../utils/orderFormatHelper");
  
  const customerFlowText = isOrderTicket
    ? [
      "**FLOW ORDER HYPERINDO**",
      "1. Pilih format order sesuai jenis layanan Anda",
      "2. Isi form sesuai dengan data yang diminta",
      "3. Klik tombol PAYMENT untuk kirim bukti transfer",
      "4. Setelah payment terkonfirmasi, order masuk antrian",
      "",
      "**PERATURAN PENTING**",
      "• Jangan kirim password/2FA di channel publik",
      "• Kirim data login hanya via private ticket/chat",
      "• Pastikan semua data sudah benar sebelum submit",
      "• Follow-up order Anda melalui ticket ini",
    ].join("\n")
    : "Gunakan tombol di bawah untuk claim atau close ticket.";

  const components = isOrderTicket
    ? [createOrderFormatButtonRows()[0], createOrderFormatButtonRows()[1], staffActionRow]
    : [staffActionRow];

  await channel.send({
    content: `${opener} Ticket order Anda sudah dibuat! ${isOrderTicket ? "Silakan pilih format order di bawah." : ""}`,
    embeds: [
      createEmbed({
        title: `Ticket #${ticket.id} - ${ticket.type}`,
        description: customerFlowText,
        fields: [
          { name: "Jenis Ticket", value: ticket.type.toUpperCase(), inline: true },
          { name: "Status", value: "🟡 MENUNGGU INPUT", inline: true },
          { name: "Pembuka", value: opener.user.tag, inline: true },
        ],
      }),
    ],
    components,
  });
}
```

### Step 5: Test Implementation
1. Buat ticket order di channel
2. Klik tombol format order
3. Fill out form dengan data test
4. Verify data tersimpan di ticket metadata

## Usage Examples

### Menampilkan Panel Format Order
```bash
/format  # Tampilkan semua format dengan buttons
/format type:joki  # Tampilkan hanya format Joki
```

### Di Ticket Channel
1. Customer membuka ticket order
2. Bot menampilkan panel dengan 10 tombol format
3. Customer klik tombol sesuai layanan yang diinginkan
4. Modal form dibuka
5. Customer isi form dan submit
6. Data tersimpan ke ticket metadata

## Database Integration

Ticket metadata structure untuk menyimpan order data:

```javascript
{
  id: "0001",
  guildId: "123456789",
  channelId: "987654321",
  openerId: "111111111",
  type: "order",
  status: "open",
  meta: {
    orderData: {
      type: "joki", // Format type
      submittedAt: "2025-05-11T10:30:00Z",
      data: {
        name: "John Doe",
        whatsapp: "+62812345678",
        gameInfo: "GAME: Valorant | PLATFORM: Windows...",
        // ... lebih banyak field
      }
    },
    paymentData: {
      method: "Bank Transfer",
      amount: 100000,
      proof: "https://...",
      confirmedAt: "2025-05-11T11:00:00Z",
    }
  }
}
```

## Security Considerations

1. **Data Privacy**: Jangan tampilkan password/2FA di public channel
2. **Validation**: Validasi semua input sebelum store ke database
3. **Rate Limiting**: Limit form submissions untuk mencegah spam
4. **Audit Trail**: Log semua submission untuk tracking
5. **Encryption**: Encrypt sensitive data seperti account credentials

## Future Enhancements

- [ ] Auto-format verification untuk ensure semua field filled
- [ ] Smart suggestions berdasarkan history customer
- [ ] Template saving untuk frequently used orders
- [ ] Export order data ke invoice/document
- [ ] Integration dengan payment gateway
- [ ] Automated order status updates
- [ ] Email notifications untuk customer & staff
- [ ] Order analytics dashboard

---

**Created**: May 11, 2026
**Last Updated**: May 11, 2026
