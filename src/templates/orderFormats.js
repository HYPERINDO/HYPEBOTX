const commonCustomerFields = [
  { name: "Nama", value: "nama", required: true },
  { name: "Username Discord", value: "discord_username", required: true },
  { name: "Nomor WhatsApp", value: "whatsapp", required: true },
];

const commonPaymentFields = [
  { name: "Metode Pembayaran", value: "payment_method", required: true },
  { name: "Total Pembayaran", value: "total_payment", required: true },
  { name: "Bukti Transfer", value: "payment_proof", required: true },
];

const generalOrderNote = [
  "1. ISI FORMAT ORDER DENGAN LENGKAP.",
  "2. KIRIM FORMAT MELALUI TICKET / CHAT ADMIN RESMI.",
  "3. JANGAN KIRIM DATA LOGIN, PASSWORD, ATAU KODE 2FA DI CHANNEL PUBLIK.",
  "4. ORDER DIPROSES SETELAH PAYMENT DAN BUKTI TRANSFER VALID.",
  "5. KESALAHAN DATA DARI CUSTOMER DI LUAR TANGGUNG JAWAB ADMIN.",
  "6. JIKA STOK / PAKET BELUM JELAS, SILAKAN TANYA ADMIN TERLEBIH DAHULU.",
  "7. STATUS ORDER AKAN DIUPDATE OLEH ADMIN: MENUNGGU PAYMENT / PROSES / SELESAI.",
].join("\n");

const orderFormats = {
  joki: {
    name: "FORMAT ORDER JOKI HYPERINDO",
    description: "Format order untuk layanan joki game.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL JOKI
GAME:
PLATFORM:
LOGIN VIA:
PAKET JOKI:
TARGET / REQUEST:
DEADLINE:
CATATAN TAMBAHAN:

DATA AKUN
EMAIL / USERNAME:
PASSWORD:
KODE 2FA / BACKUP CODE:
CATATAN LOGIN:

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI

NOTE:
DATA LOGIN JANGAN DIKIRIM DI CHANNEL PUBLIK.
DATA LOGIN HANYA DIKIRIM MELALUI TICKET / CHAT ADMIN RESMI HYPERINDO.`,
    fields: [
      ...commonCustomerFields,
      { name: "Game", value: "game", required: true },
      { name: "Platform", value: "platform", required: true },
      { name: "Login Via", value: "login_via", required: true },
      { name: "Paket Joki", value: "paket_joki", required: true },
      { name: "Target / Request", value: "target", required: true },
      { name: "Deadline", value: "deadline", required: true },
      { name: "Catatan Tambahan", value: "catatan", required: false },
      { name: "Data Akun", value: "account_data", required: true },
      ...commonPaymentFields,
    ],
  },
  topup: {
    name: "FORMAT ORDER TOP UP HYPERINDO",
    description: "Format order untuk layanan top up game.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL TOP UP
GAME:
NICKNAME GAME:
USER ID:
SERVER ID:
PAKET / NOMINAL TOP UP:
JUMLAH ORDER:
CATATAN TAMBAHAN:

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI

NOTE:
PASTIKAN USER ID DAN SERVER ID SUDAH BENAR.
KESALAHAN DATA DARI CUSTOMER DI LUAR TANGGUNG JAWAB ADMIN.`,
    fields: [
      ...commonCustomerFields,
      { name: "Game", value: "game", required: true },
      { name: "Nickname Game", value: "nickname", required: true },
      { name: "User ID", value: "user_id", required: true },
      { name: "Server ID", value: "server_id", required: true },
      { name: "Paket / Nominal Top Up", value: "nominal", required: true },
      { name: "Jumlah Order", value: "quantity", required: true },
      { name: "Catatan Tambahan", value: "catatan", required: false },
      ...commonPaymentFields,
    ],
  },
  windows: {
    name: "FORMAT ORDER LISENSI WINDOWS HYPERINDO",
    description: "Format order untuk lisensi Windows.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL ORDER
PRODUK: WINDOWS 10 / WINDOWS 11
EDISI: HOME / PRO
JUMLAH LISENSI:
UNTUK BERAPA DEVICE:
STATUS WINDOWS SAAT INI:
BUTUH BANTU AKTIVASI: YA / TIDAK
CATATAN TAMBAHAN:

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI

NOTE:
PASTIKAN EDISI WINDOWS SESUAI DENGAN DEVICE KAMU.
JANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.
JIKA BUTUH BANTU AKTIVASI, ADMIN AKAN PANDU VIA TICKET / CHAT PRIVATE.`,
    fields: [
      ...commonCustomerFields,
      { name: "Produk", value: "produk", required: true },
      { name: "Edisi", value: "edisi", required: true },
      { name: "Jumlah Lisensi", value: "jumlah_lisensi", required: true },
      { name: "Untuk Berapa Device", value: "device_count", required: true },
      { name: "Status Windows Saat Ini", value: "windows_status", required: true },
      { name: "Butuh Bantu Aktivasi", value: "butuh_aktivasi", required: true },
      { name: "Catatan Tambahan", value: "catatan", required: false },
      ...commonPaymentFields,
    ],
  },
  office: {
    name: "FORMAT ORDER OFFICE KEY HYPERINDO",
    description: "Format order untuk Office key.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL ORDER
PRODUK: OFFICE 2019 / OFFICE 2021 / OFFICE 365
JUMLAH LISENSI:
UNTUK BERAPA DEVICE:
BUTUH PANDUAN AKTIVASI: YA / TIDAK
CATATAN TAMBAHAN:

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI

NOTE:
PASTIKAN PRODUK OFFICE SESUAI KEBUTUHAN.
JANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.`,
    fields: [
      ...commonCustomerFields,
      { name: "Produk", value: "produk", required: true },
      { name: "Jumlah Lisensi", value: "jumlah_lisensi", required: true },
      { name: "Untuk Berapa Device", value: "device_count", required: true },
      { name: "Butuh Panduan Aktivasi", value: "butuh_panduan", required: true },
      { name: "Catatan Tambahan", value: "catatan", required: false },
      ...commonPaymentFields,
    ],
  },
  optimizer: {
    name: "FORMAT ORDER OPTIMIZER WINDOWS HYPERINDO",
    description: "Format order untuk optimizer Windows.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL DEVICE
JENIS DEVICE: PC / LAPTOP
WINDOWS: WINDOWS 10 / WINDOWS 11
PROCESSOR:
RAM:
VGA / GPU:
STORAGE: HDD / SSD / NVME

DETAIL OPTIMIZER
KELUHAN UTAMA:
TUJUAN OPTIMIZER: GAMING / STREAMING / EDITING / KERJA / ALL PURPOSE
GAME / APLIKASI YANG SERING DIPAKAI:
BUTUH SETTING OBS / STREAMING: YA / TIDAK
BUTUH CEK DRIVER: YA / TIDAK
BUTUH CEK STARTUP APP: YA / TIDAK
CATATAN TAMBAHAN:

JADWAL PENGERJAAN
HARI / JAM YANG BISA:
METODE PENGERJAAN: REMOTE / PANDUAN CHAT

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI

NOTE:
JANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.
JIKA BUTUH REMOTE, ADMIN AKAN PANDU LEWAT TICKET / CHAT PRIVATE.`,
    fields: [
      ...commonCustomerFields,
      { name: "Detail Device", value: "device_detail", required: true },
      { name: "Keluhan Utama", value: "keluhan", required: true },
      { name: "Tujuan Optimizer", value: "tujuan", required: true },
      { name: "Aplikasi Yang Sering Dipakai", value: "aplikasi", required: false },
      { name: "Jadwal Pengerjaan", value: "jadwal", required: true },
      { name: "Metode Pengerjaan", value: "metode", required: true },
      ...commonPaymentFields,
    ],
  },
  gameAccount: {
    name: "FORMAT ORDER JUAL AKUN GAME HYPERINDO",
    description: "Format order untuk pembelian akun game.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL AKUN
GAME:
JENIS AKUN:
PAKET AKUN:
LOGIN VIA:
REQUEST KHUSUS:
BUDGET:
CATATAN TAMBAHAN:

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI

NOTE:
STOK AKUN TANYA ADMIN TERLEBIH DAHULU.
DATA AKUN DIKIRIM SETELAH PAYMENT SELESAI.`,
    fields: [
      ...commonCustomerFields,
      { name: "Game", value: "game", required: true },
      { name: "Jenis Akun", value: "jenis_akun", required: true },
      { name: "Paket Akun", value: "paket_akun", required: true },
      { name: "Login Via", value: "login_via", required: true },
      { name: "Request Khusus", value: "request_khusus", required: false },
      { name: "Budget", value: "budget", required: true },
      { name: "Catatan Tambahan", value: "catatan", required: false },
      ...commonPaymentFields,
    ],
  },
  gta: {
    name: "FORMAT ORDER AKUN GTA HYPERINDO",
    description: "Format order untuk pembelian akun GTA.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL AKUN GTA
JENIS AKUN:

* AKUN POLOSAN
* AKUN SESUAI PAKET
* AKUN SAUDARA
* AKUN + ROCKSTAR

PLATFORM:
LOGIN VIA:
REQUEST LEVEL / UANG / ITEM:
BUDGET:
CATATAN TAMBAHAN:

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI

NOTE:
HARGA AKUN POLOSAN MULAI DARI 150K.
STOK TANYA ADMIN.
AKUN SUDAH SEPAKET DENGAN AKUN ROCKSTAR JIKA TERCANTUM DI PAKET.`,
    fields: [
      ...commonCustomerFields,
      { name: "Jenis Akun", value: "jenis_akun", required: true },
      { name: "Platform", value: "platform", required: true },
      { name: "Login Via", value: "login_via", required: true },
      { name: "Request Level / Uang / Item", value: "request_items", required: false },
      { name: "Budget", value: "budget", required: true },
      { name: "Catatan Tambahan", value: "catatan", required: false },
      ...commonPaymentFields,
    ],
  },
  discordServer: {
    name: "FORMAT ORDER JASA SERVER DISCORD HYPERINDO",
    description: "Format order untuk jasa server Discord.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL SERVER
JENIS SERVER:
TEMA SERVER:
JUMLAH CHANNEL:
JUMLAH ROLE:
BUTUH BOT: YA / TIDAK
BOT YANG DIINGINKAN:
BUTUH LOGO / BANNER: YA / TIDAK
DEADLINE:
REFERENSI SERVER:
CATATAN TAMBAHAN:

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI`,
    fields: [
      ...commonCustomerFields,
      { name: "Jenis Server", value: "jenis_server", required: true },
      { name: "Tema Server", value: "tema_server", required: true },
      { name: "Jumlah Channel", value: "jumlah_channel", required: true },
      { name: "Jumlah Role", value: "jumlah_role", required: true },
      { name: "Butuh Bot", value: "butuh_bot", required: true },
      { name: "Bot Yang Diinginkan", value: "bot_list", required: false },
      { name: "Butuh Logo / Banner", value: "logo_banner", required: false },
      { name: "Deadline", value: "deadline", required: true },
      { name: "Referensi Server", value: "referensi", required: false },
      { name: "Catatan Tambahan", value: "catatan", required: false },
      ...commonPaymentFields,
    ],
  },
  bundle: {
    name: "FORMAT ORDER PAKET BUNDLE HYPERINDO",
    description: "Format order untuk paket bundle.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL BUNDLE
PAKET BUNDLE YANG DIPILIH:
ISI PAKET:
GAME / PRODUK:
REQUEST TAMBAHAN:
DEADLINE:
CATATAN TAMBAHAN:

PAYMENT
METODE PEMBAYARAN:
TOTAL PEMBAYARAN:
BUKTI TRANSFER:

STATUS ORDER:
MENUNGGU PAYMENT / PROSES / SELESAI

NOTE:
PAKET BUNDLE BISA BERISI JOKI, AKUN, TOP UP, OPTIMIZER, WINDOWS / OFFICE KEY, ATAU JASA DISCORD.`,
    fields: [
      ...commonCustomerFields,
      { name: "Paket Bundle Yang Dipilih", value: "paket_bundle", required: true },
      { name: "Isi Paket", value: "isi_paket", required: true },
      { name: "Game / Produk", value: "game_produk", required: true },
      { name: "Request Tambahan", value: "request_tambahan", required: false },
      { name: "Deadline", value: "deadline", required: true },
      { name: "Catatan Tambahan", value: "catatan", required: false },
      ...commonPaymentFields,
    ],
  },
  warranty: {
    name: "FORMAT CLAIM GARANSI / KOMPLAIN HYPERINDO",
    description: "Format untuk klaim garansi dan komplain.",
    format: `DATA CUSTOMER
NAMA:
USERNAME DISCORD:
NOMOR WHATSAPP:

DETAIL ORDER
LAYANAN YANG DIBELI:
TANGGAL ORDER:
NAMA ADMIN YANG HANDLE:
NOMOR INVOICE / TICKET JIKA ADA:

DETAIL MASALAH
MASALAH / KELUHAN:
BUKTI SCREENSHOT / VIDEO:
REQUEST SOLUSI:
CATATAN TAMBAHAN:

STATUS CLAIM:
MENUNGGU CEK ADMIN / DIPROSES / SELESAI

NOTE:
CLAIM GARANSI WAJIB MENYERTAKAN BUKTI.
ADMIN AKAN CEK RIWAYAT ORDER TERLEBIH DAHULU.`,
    fields: [
      ...commonCustomerFields,
      { name: "Layanan Yang Dibeli", value: "layanan", required: true },
      { name: "Tanggal Order", value: "tanggal_order", required: true },
      { name: "Nama Admin Yang Handle", value: "admin_name", required: false },
      { name: "Nomor Invoice / Ticket", value: "invoice_ticket", required: false },
      { name: "Masalah / Keluhan", value: "masalah", required: true },
      { name: "Bukti Screenshot / Video", value: "bukti", required: true },
      { name: "Request Solusi", value: "request_solusi", required: true },
      { name: "Catatan Tambahan", value: "catatan", required: false },
    ],
  },
};

function getFormatTemplate(type) {
  return orderFormats[type] || null;
}

function getAllFormats() {
  return Object.keys(orderFormats).map((key) => ({
    id: key,
    name: orderFormats[key].name,
    description: orderFormats[key].description,
  }));
}

function getFormatByName(name) {
  for (const [key, format] of Object.entries(orderFormats)) {
    if (format.name.toLowerCase().includes(name.toLowerCase())) {
      return key;
    }
  }
  return null;
}

module.exports = {
  orderFormats,
  generalOrderNote,
  getFormatTemplate,
  getAllFormats,
  getFormatByName,
};
