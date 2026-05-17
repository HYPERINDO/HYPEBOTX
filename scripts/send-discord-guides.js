const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const {
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionsBitField,
} = require("discord.js");

const repoRoot = path.resolve(__dirname, "..");
const envPath = [".env.local", ".env"]
  .map((file) => path.join(repoRoot, file))
  .find((file) => fs.existsSync(file));

if (envPath) {
  dotenv.config({ path: envPath, override: true });
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const onlyArg = args.find((arg) => arg.startsWith("--only="));
const versionArg = args.find((arg) => arg.startsWith("--version="));
const version = versionArg ? versionArg.slice("--version=".length).trim() : "2026-05-17";
const only = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((item) => normalizeKey(item)).filter(Boolean))
  : null;

const footerText = `HYPEBOTX Usage Guide ${version}`;
const results = [];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[|｜丨]/g, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeKey(value) {
  return normalizeText(value).replace(/\s+/g, "-");
}

function categoryMatches(category, label) {
  if (!label) return true;
  return normalizeText(category?.name).includes(normalizeText(label));
}

function channelMatches(channel, name) {
  const current = normalizeText(channel?.name);
  const wanted = normalizeText(name);
  return current === wanted || current.endsWith(` ${wanted}`);
}

function add(area, name, status, detail = "") {
  results.push({ area, name, status, detail });
}

function envValue(name) {
  return String(process.env[name] || "").trim();
}

function lines(items) {
  return items.filter(Boolean).join("\n");
}

function list(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function field(name, value) {
  return { name, value: String(value || "-").slice(0, 1024), inline: false };
}

function guide(category, channel, title, description, fields, color = 0x2f80ed) {
  return { category, channel, title, description, fields, color };
}

const commonSafety = [
  "Transaksi hanya lewat ticket/channel resmi HYPERINDO.",
  "Jangan kirim password, OTP, cookie, atau recovery code di channel publik.",
  "Bukti bayar dikirim sebagai gambar di ticket order, bukan lewat DM admin.",
  "Simpan Order ID, Ticket ID, dan bukti transfer sampai order selesai.",
];

const orderFlow = [
  "Klik ORDER di #open-ticket atau buka /panel.",
  "Pilih kategori layanan, paket, dan isi form sesuai instruksi.",
  "Cek ringkasan order dan invoice sebelum bayar.",
  "Bayar sesuai nominal dan metode resmi di #payment-method.",
  "Upload screenshot/foto bukti pembayaran di ticket order.",
  "Tunggu admin approve, lalu order masuk proses sampai DONE.",
];

function productGuide(category, channel, label, details) {
  return guide(
    category,
    channel,
    `Panduan ${label}`,
    `Channel ini khusus info dan order ${label}. Gunakan alur resmi agar stok, invoice, dan bukti pembayaran tercatat rapi.`,
    [
      field("Cara order", list([
        "Cek nama produk/paket yang kamu mau.",
        "Buka #open-ticket dan pilih kategori yang sesuai.",
        "Isi detail yang diminta, lalu tunggu invoice.",
        "Payment hanya lewat metode resmi di #payment-method.",
      ])),
      field("Data yang biasanya dibutuhkan", list(details)),
      field("Catatan aman", list([
        "Stok bisa berubah, jadi tunggu konfirmasi/invoice sebelum bayar.",
        "Produk digital dikirim lewat ticket/DM sesuai SOP admin.",
        "Garansi diproses lewat #claim-warranty dengan bukti yang jelas.",
      ])),
    ],
    0x3498db,
  );
}

function chatGuide(category, channel, title, allowed, avoid = []) {
  return guide(
    category,
    channel,
    title,
    "Gunakan channel ini sesuai topik supaya diskusi tetap rapi dan staff mudah bantu.",
    [
      field("Boleh digunakan untuk", list(allowed)),
      field("Hindari", list([
        "Spam, flood, promosi tanpa izin, atau tag staff berulang.",
        "Data login, bukti payment, nomor pribadi, dan info sensitif.",
        ...avoid,
      ])),
      field("Butuh bantuan order?", "Untuk order/payment/warranty, gunakan #open-ticket atau #report-problem supaya tercatat."),
    ],
    0x5865f2,
  );
}

const guides = [
  guide("INFO", "welcome", "Mulai di HYPERINDO", "Selamat datang. Ikuti urutan ini supaya akses member, order, dan bantuan admin berjalan mulus.", [
    field("Langkah member baru", list([
      "Baca #rules.",
      "Klik VERIFY di #verify.",
      "Pilih role GTA di #choose-role kalau perlu.",
      "Cek #faq dan #how-to-order sebelum transaksi.",
      "Buka #open-ticket untuk order atau bantuan admin.",
    ])),
    field("Command/panel utama", list([
      "/panel untuk menu member/customer.",
      "Tombol ORDER untuk checkout bertahap.",
      "Tombol CEK PESANAN atau /status untuk cek order.",
      "/faq untuk bantuan cepat.",
    ])),
    field("Aman transaksi", list(commonSafety)),
  ]),
  guide("INFO", "rules", "Rules Server dan Transaksi", "Rules ini menjaga server tetap nyaman dan transaksi tetap aman.", [
    field("Rules umum", list([
      "Gunakan bahasa sopan dan tetap sesuai channel.",
      "Dilarang spam, scam, phishing, jualan liar, atau impersonasi staff.",
      "Ikuti arahan staff saat order, warranty, refund, atau dispute.",
    ])),
    field("Rules transaksi", list([
      "Jangan bayar sebelum invoice/order sudah jelas.",
      "Nominal harus sesuai invoice.",
      "Bukti bayar wajib berupa screenshot/foto yang jelas.",
      "Refund/dispute hanya diproses lewat ticket resmi.",
    ])),
    field("Privasi", list(commonSafety.slice(1))),
  ], 0xe74c3c),
  guide("INFO", "verify", "Panduan Verify Member", "Verify membuka akses member ke channel publik dan fitur order.", [
    field("Cara verify", list([
      "Klik tombol VERIFY di channel ini.",
      "Jika berhasil, role MEMBER aktif otomatis.",
      "Kalau tombol gagal, tunggu sebentar lalu coba lagi.",
      "Jika masih gagal, buka #report-problem atau hubungi staff.",
    ])),
    field("Setelah verify", list([
      "Pilih role di #choose-role.",
      "Buka #how-to-order untuk panduan transaksi.",
      "Gunakan #open-ticket untuk order/support.",
    ])),
  ], 0x2ecc71),
  guide("INFO", "choose-role", "Panduan Pilih Role", "Role membantu staff dan member tahu versi/game yang kamu pakai.", [
    field("Pilihan role", list([
      "LEGACY untuk GTA Legacy.",
      "ENHANCED untuk GTA Enhanced.",
      "Role bisa diubah lagi dari channel ini jika kebutuhan berubah.",
    ])),
    field("Kenapa penting?", list([
      "Mencegah salah paket/jasa.",
      "Membantu antrian joki lebih rapi.",
      "Membantu diskusi di room GTA sesuai versi.",
    ])),
  ], 0x9b59b6),
  guide("INFO", "faq", "FAQ dan Bantuan Cepat", "Cek FAQ sebelum bertanya agar jawaban dasar bisa langsung ketemu.", [
    field("Pertanyaan umum", list([
      "Cara order: cek #how-to-order lalu #open-ticket.",
      "Payment: cek #payment-method dan upload bukti di ticket.",
      "Status order: cek #order-status atau tombol CEK PESANAN.",
      "Warranty/claim: buka #claim-warranty.",
      "Masalah order: buka #report-problem.",
    ])),
    field("Command bantuan", list([
      "/panel untuk menu utama.",
      "/faq untuk tanya bantuan cepat.",
      "/status untuk cek status dengan Order ID/Ticket ID.",
      "/price untuk cek harga jika command tersedia di server.",
    ])),
  ], 0x95a5a6),

  guide("ORDER CENTER", "how-to-order", "Panduan Order Lengkap", "Gunakan flow resmi agar invoice, payment, ticket, audit log, dan status order tercatat otomatis.", [
    field("Flow order", list(orderFlow)),
    field("Status order", list([
      "PENDING/WAITING_PAYMENT: invoice dibuat, menunggu payment.",
      "PAYMENT_REVIEW: bukti bayar masuk, menunggu admin approve.",
      "PROCESSING/WORKING: order sedang dikerjakan.",
      "DONE: order selesai.",
      "CANCELLED/REFUND/DISPUTE: order dibatalkan atau butuh review khusus.",
    ])),
    field("Tips cepat", list([
      "Sebutkan kebutuhan dengan jelas sejak awal.",
      "Jangan spam ticket; update secukupnya agar staff mudah baca.",
      "Untuk data sensitif, kirim hanya di ticket private.",
    ])),
  ], 0x2ecc71),
  guide("ORDER CENTER", "open-ticket", "Panduan Open Ticket", "Channel ini adalah pintu utama order dan bantuan admin.", [
    field("Tombol yang tersedia", list([
      "ORDER: mulai checkout bertahap.",
      "CEK PESANAN: cek order terakhir/status.",
      "PEMBAYARAN: lihat arahan payment.",
      "BANTUAN ADMIN: buat ticket bantuan.",
    ])),
    field("Saat ticket dibuat", list([
      "Customer dan staff masuk ke ticket private/thread.",
      "Ikuti instruksi bot sampai invoice muncul.",
      "Upload bukti bayar di ticket yang sama.",
      "Staff akan approve payment dan update status.",
    ])),
    field("Jangan dilakukan", list([
      "Jangan buat ticket dobel untuk order yang sama.",
      "Jangan kirim bukti bayar di channel publik.",
      "Jangan close ticket sebelum order selesai.",
    ])),
  ], 0x57f287),
  guide("ORDER CENTER", "payment-method", "Panduan Payment", "Gunakan hanya metode payment resmi yang tampil di channel ini atau di invoice ticket.", [
    field("Cara bayar", list([
      "Pastikan invoice/order sudah valid.",
      "Bayar sesuai nominal, jangan dibulatkan tanpa arahan staff.",
      "Upload screenshot/foto bukti bayar di ticket order.",
      "Tunggu admin approve sebelum order diproses.",
    ])),
    field("Validasi admin", list([
      "Bukti transfer masuk ke payment review.",
      "Admin approve/reject dari panel atau tombol ticket.",
      "Jika reject, ikuti alasan dan kirim ulang bukti yang benar.",
    ])),
    field("Waspada scam", list([
      "Jangan bayar ke rekening/ewallet yang dikirim lewat DM pribadi.",
      "Admin tidak akan minta OTP, password, cookie, atau recovery code.",
    ])),
  ], 0xf1c40f),
  guide("ORDER CENTER", "order-status", "Panduan Cek Status Order", "Cek status order tanpa spam admin.", [
    field("Cara cek", list([
      "Gunakan tombol CEK PESANAN di #open-ticket.",
      "Gunakan /status jika command tersedia.",
      "Siapkan Order ID atau Ticket ID.",
      "Cek update terbaru di ticket order kamu.",
    ])),
    field("Kapan hubungi staff?", list([
      "Payment sudah dikirim tapi belum direview cukup lama.",
      "Order stuck di HOLD dan butuh info tambahan.",
      "Ada kesalahan data order atau paket.",
      "Butuh warranty/refund/dispute.",
    ])),
  ], 0x3498db),
  guide("ORDER CENTER", "report-problem", "Panduan Report Problem", "Gunakan channel ini untuk masalah transaksi, akses, bug, atau laporan yang butuh staff.", [
    field("Format laporan", lines([
      "Order ID / Ticket ID:",
      "Masalah:",
      "Waktu kejadian:",
      "Bukti/screenshot:",
      "Yang sudah dicoba:",
    ])),
    field("Kategori masalah", list([
      "Payment belum terdeteksi.",
      "Ticket tidak bisa dibuka/ditutup.",
      "Produk/joki/topup bermasalah.",
      "Bug bot/dashboard.",
      "Laporan member/scam.",
    ])),
  ], 0xe67e22),

  productGuide("PRODUCTS", "steam-products", "Steam Products", [
    "Link/nama game atau item Steam.",
    "Region akun jika relevan.",
    "Catatan gift/key/wallet sesuai stok.",
  ]),
  productGuide("PRODUCTS", "epic-products", "Epic Products", [
    "Nama game/item Epic.",
    "Region akun jika relevan.",
    "Kebutuhan delivery: key, gift, atau akun.",
  ]),
  productGuide("PRODUCTS", "rockstar-products", "Rockstar Products", [
    "Produk Rockstar/GTA yang dibutuhkan.",
    "Platform dan versi game.",
    "Detail akun hanya di ticket private jika diminta.",
  ]),
  productGuide("PRODUCTS", "windows-office-key", "Windows / Office Key", [
    "Versi Windows atau Office.",
    "Jenis lisensi yang dibutuhkan.",
    "Bukti aktivasi/error jika claim warranty.",
  ]),
  productGuide("PRODUCTS", "optimizer-windows", "Optimizer Windows", [
    "Versi Windows.",
    "Spesifikasi PC singkat.",
    "Keluhan utama: FPS, stutter, boot lambat, suhu, atau network.",
  ]),
  productGuide("PRODUCTS", "game-boosting", "Game Boosting", [
    "Game dan target boost.",
    "Deadline atau jadwal main.",
    "Metode login/invite sesuai arahan staff.",
  ]),
  productGuide("PRODUCTS", "game-top-up", "Game Top Up", [
    "Game dan nominal/topup package.",
    "User ID/server/region.",
    "Pastikan data benar sebelum invoice.",
  ]),
  productGuide("PRODUCTS", "account-market", "Account Market", [
    "Jenis akun yang dicari/dijual.",
    "Budget dan spesifikasi akun.",
    "Riwayat/garansi sesuai arahan staff.",
  ]),
  productGuide("PRODUCTS", "account-settings", "Account Settings", [
    "Jenis bantuan akun.",
    "Platform dan kendala.",
    "Data sensitif hanya di ticket private.",
  ]),

  guide("STORE", "promo", "Panduan Promo", "Channel ini berisi promo aktif, voucher, dan info diskon.", [
    field("Cara pakai promo", list([
      "Baca syarat promo sebelum order.",
      "Masukkan kode kupon saat checkout jika tersedia.",
      "Promo tidak selalu bisa digabung.",
      "Staff/owner berhak menolak promo yang tidak sesuai syarat.",
    ])),
    field("Perlu bantuan?", "Buka #open-ticket dan sebutkan kode promo yang ingin digunakan."),
  ], 0xe84393),
  guide("STORE", "stock-update", "Panduan Stock Update", "Channel ini untuk update stok produk, key, akun, dan slot layanan.", [
    field("Cara membaca stok", list([
      "Ready: bisa dipesan setelah invoice.",
      "Limited: stok/slot terbatas, tunggu konfirmasi staff.",
      "Sold/Out: jangan bayar sebelum stok tersedia lagi.",
      "Pre-order: estimasi mengikuti info staff.",
    ])),
    field("Catatan", "Stok bukan invoice. Tetap buka ticket agar order tercatat dan diproses aman."),
  ], 0x16a085),
  guide("STORE", "claim-warranty", "Panduan Claim Warranty", "Gunakan channel ini untuk klaim garansi produk, akun, key, jasa, atau hasil optimasi.", [
    field("Format claim", lines([
      "Order ID / Ticket ID:",
      "Produk/jasa:",
      "Masalah:",
      "Bukti screenshot/video:",
      "Kapan mulai terjadi:",
    ])),
    field("Syarat umum", list([
      "Claim hanya untuk transaksi resmi HYPERINDO.",
      "Bukti wajib jelas dan tidak diedit.",
      "Jangan hapus ticket/chat order sebelum claim selesai.",
    ])),
  ], 0x1abc9c),

  guide("GTA SERVICES", "announcement", "Info GTA Services", "Channel ini untuk pengumuman layanan GTA: update paket, rules joki, maintenance, dan slot kerja.", [
    field("Yang perlu dipantau", list([
      "Update harga/paket.",
      "Perubahan Legacy/Enhanced.",
      "Slot joki dan estimasi antrian.",
      "Rules akun dan batasan layanan.",
    ])),
    field("Mulai order GTA", "Cek #price-list lalu buka #open-ticket."),
  ], 0xe74c3c),
  guide("GTA SERVICES", "price-list", "Panduan Pricelist GTA", "Gunakan channel ini untuk membaca harga layanan GTA sebelum order.", [
    field("Cara pilih paket", list([
      "Pastikan versi: Legacy atau Enhanced.",
      "Cek target layanan dan estimasi waktu.",
      "Jika ragu, tanya di #gta-chat atau buka ticket konsultasi.",
      "Harga final tetap mengikuti invoice di ticket.",
    ])),
    field("Setelah pilih paket", "Buka #open-ticket, pilih layanan GTA/joki, lalu isi form yang diminta."),
  ], 0xf39c12),
  guide("GTA SERVICES", "account-showcase", "Panduan Account Showcase", "Channel ini untuk melihat contoh akun/result yang tersedia atau pernah dikerjakan.", [
    field("Gunakan untuk", list([
      "Melihat referensi akun/build.",
      "Membandingkan kebutuhan sebelum order.",
      "Minta detail stok lewat ticket, bukan DM personal.",
    ])),
    field("Catatan", "Showcase bukan janji stok selalu ready. Tunggu konfirmasi staff sebelum payment."),
  ], 0x9b59b6),
  guide("GTA SERVICES", "queue-list", "Panduan Queue Joki", "Channel ini membantu customer, admin, dan penjoki melihat alur antrian.", [
    field("Untuk customer", list([
      "Cek posisi/status order tanpa spam ticket.",
      "Jika status HOLD, baca instruksi staff di ticket.",
      "Jika DONE, cek hasil dan konfirmasi jika diminta.",
    ])),
    field("Untuk penjoki", list([
      "Claim job dari panel/queue sesuai arahan admin.",
      "Update progress: WORKING, HOLD, SUBMIT DONE.",
      "Jangan ubah job orang lain tanpa instruksi admin.",
    ])),
    field("Untuk admin", list([
      "Review payment sebelum queue aktif.",
      "Approve/reject hasil penjoki.",
      "Reassign jika ada kendala shift atau akses.",
    ])),
  ], 0x2ecc71),
  chatGuide("GTA SERVICES", "gta-chat", "Panduan GTA Chat", [
    "Diskusi GTA umum.",
    "Tanya paket/versi sebelum order.",
    "Share pengalaman ringan tanpa data sensitif.",
  ]),
  chatGuide("GTA SERVICES", "legacy-room", "Panduan Legacy Room", [
    "Diskusi GTA Legacy.",
    "Koordinasi role/versi Legacy.",
    "Tanya kompatibilitas layanan Legacy.",
  ]),
  chatGuide("GTA SERVICES", "enhanced-room", "Panduan Enhanced Room", [
    "Diskusi GTA Enhanced.",
    "Koordinasi role/versi Enhanced.",
    "Tanya kompatibilitas layanan Enhanced.",
  ]),
  guide("GTA SERVICES", "gta-testimonials", "Panduan Testimoni GTA", "Kirim testimoni setelah order selesai supaya member lain punya referensi.", [
    field("Format testimoni", lines([
      "Layanan:",
      "Rating:",
      "Komentar singkat:",
      "Screenshot hasil jika aman:",
    ])),
    field("Catatan", list([
      "Jangan tampilkan data login, email, atau info pribadi.",
      "Testimoni palsu/spam akan dihapus.",
    ])),
  ], 0xf1c40f),

  guide("PC OPTIMIZER", "pc-consultation", "Panduan PC Consultation", "Gunakan channel ini untuk konsultasi awal masalah PC sebelum order optimasi.", [
    field("Format konsultasi", lines([
      "CPU/GPU/RAM:",
      "Storage:",
      "Windows version:",
      "Game/aplikasi yang bermasalah:",
      "Keluhan utama:",
      "Screenshot benchmark/error jika ada:",
    ])),
    field("Jalur order", "Jika sudah cocok, buka #open-ticket dan pilih layanan optimizer."),
  ], 0x3498db),
  guide("PC OPTIMIZER", "optimization-tips", "Panduan Optimization Tips", "Channel ini berisi tips aman untuk performa PC.", [
    field("Tips aman", list([
      "Buat restore point sebelum tweak besar.",
      "Update driver dari sumber resmi.",
      "Jangan install optimizer random dari DM/link tidak jelas.",
      "Catat perubahan sebelum dan sesudah optimasi.",
    ])),
    field("Butuh bantuan lanjut?", "Gunakan #pc-consultation atau #open-ticket."),
  ], 0x1abc9c),
  guide("PC OPTIMIZER", "hyperboostx-info", "Panduan HyperBoostX Info", "Channel ini menjelaskan layanan HyperBoostX dan batasan optimasi.", [
    field("Yang bisa dibantu", list([
      "FPS/stutter troubleshooting.",
      "Startup/service cleanup.",
      "Network latency basic check.",
      "Game setting dan Windows tuning.",
    ])),
    field("Batasan", list([
      "Hasil tergantung hardware, game, driver, suhu, dan kondisi OS.",
      "Optimasi tidak mengganti kebutuhan upgrade hardware.",
    ])),
  ], 0x8e44ad),
  productGuide("PC OPTIMIZER", "optimizer-service", "Optimizer Service", [
    "Spesifikasi PC.",
    "Target game/aplikasi.",
    "Keluhan dan target hasil.",
  ]),
  guide("PC OPTIMIZER", "optimizer-results", "Panduan Optimizer Results", "Channel ini untuk hasil optimasi yang aman dibagikan.", [
    field("Boleh dikirim", list([
      "Before/after FPS atau benchmark.",
      "Screenshot setting non-sensitif.",
      "Catatan singkat perubahan hasil.",
    ])),
    field("Jangan dikirim", list([
      "Serial number, email, IP publik, license key, atau data pribadi.",
      "Screenshot yang menampilkan akun/login.",
    ])),
  ], 0x2ecc71),
  guide("PC OPTIMIZER", "optimizer-testimonials", "Panduan Testimoni Optimizer", "Kirim feedback setelah layanan optimizer selesai.", [
    field("Format", lines([
      "Layanan:",
      "Masalah sebelum:",
      "Hasil sesudah:",
      "Rating:",
      "Catatan:",
    ])),
    field("Catatan aman", "Sensor data pribadi sebelum upload screenshot."),
  ], 0xf1c40f),

  guide("STREAM AREA", "live-notification", "Panduan Live Notification", "Channel ini untuk notifikasi live/stream resmi.", [
    field("Gunakan untuk", list([
      "Cek info live terbaru.",
      "Ikuti event/stream sesuai jadwal.",
      "Jangan spam saat notifikasi masuk.",
    ])),
    field("Info jadwal", "Cek #stream-schedule untuk agenda berikutnya."),
  ], 0xe74c3c),
  guide("STREAM AREA", "stream-schedule", "Panduan Stream Schedule", "Channel ini berisi jadwal live, event, dan agenda stream.", [
    field("Yang dicantumkan", list([
      "Tanggal dan jam live.",
      "Topik/game/event.",
      "Link atau platform live jika tersedia.",
      "Perubahan jadwal dari admin.",
    ])),
  ], 0x3498db),
  chatGuide("STREAM AREA", "stream-chat", "Panduan Stream Chat", [
    "Diskusi stream yang sedang berjalan.",
    "Tanya jadwal/event stream.",
    "Share momen stream yang relevan.",
  ]),
  guide("STREAM AREA", "live-accounts", "Panduan Live Accounts", "Channel ini untuk info akun/platform live yang resmi.", [
    field("Catatan", list([
      "Ikuti hanya link akun resmi dari admin.",
      "Laporkan akun palsu/impersonator lewat #report-problem.",
      "Jangan share token stream atau akses akun.",
    ])),
  ], 0x9b59b6),

  guide("EVENTS", "giveaway", "Panduan Giveaway", "Ikuti giveaway sesuai rules yang ditulis di tiap event.", [
    field("Cara ikut", list([
      "Baca syarat giveaway.",
      "Ikuti instruksi tombol/reaction/form.",
      "Satu akun utama, jangan multi-account.",
      "Pemenang diumumkan di #event-winner.",
    ])),
    field("Diskualifikasi", list([
      "Spam, akun palsu, manipulasi invite, atau melanggar rules.",
      "Tidak bisa dikontak saat validasi pemenang.",
    ])),
  ], 0xe84393),
  guide("EVENTS", "event-winner", "Panduan Event Winner", "Channel ini untuk pengumuman pemenang event/giveaway.", [
    field("Jika menang", list([
      "Ikuti instruksi claim dari admin.",
      "Jangan kirim data sensitif di channel publik.",
      "Claim yang butuh data pribadi akan diarahkan ke ticket/DM resmi staff.",
    ])),
  ], 0xf1c40f),

  chatGuide("COMMUNITY", "community-chat", "Panduan Community Chat", [
    "Ngobrol umum sesama member.",
    "Tanya ringan sebelum diarahkan ke ticket.",
    "Bantu jawab member lain dengan sopan.",
  ]),
  guide("COMMUNITY", "content", "Panduan Content", "Channel ini untuk sharing konten komunitas yang relevan.", [
    field("Boleh dikirim", list([
      "Clip gameplay.",
      "Screenshot hasil game/setup.",
      "Konten edukasi yang relevan.",
    ])),
    field("Tidak boleh", list([
      "Konten NSFW, scam, leak, cheat, atau link berbahaya.",
      "Konten yang menampilkan data pribadi tanpa sensor.",
    ])),
  ], 0x5865f2),
  guide("COMMUNITY", "media-share", "Panduan Media Share", "Bagikan media dengan rapi dan aman.", [
    field("Boleh", list([
      "Screenshot, clip, foto setup, meme ringan yang sesuai rules.",
      "Media harus relevan dengan komunitas.",
    ])),
    field("Hindari", list([
      "Spam file besar.",
      "Media yang menampilkan password, email, license key, atau payment.",
      "Konten berhak cipta yang bermasalah.",
    ])),
  ], 0x3498db),
  guide("COMMUNITY", "music-request", "Panduan Music Request", "Gunakan channel ini untuk request musik jika fitur music bot aktif.", [
    field("Command umum", list([
      "/play untuk memutar lagu.",
      "/pause, /resume, /skip, /stop untuk kontrol.",
      "/queue dan /nowplaying untuk cek antrian.",
      "/volume, /loop, /leave jika tersedia sesuai izin role.",
    ])),
    field("Etika", list([
      "Jangan spam request.",
      "Ikuti giliran dan arahan DJ/staff.",
      "Konten harus sesuai rules server.",
    ])),
  ], 0x9b59b6),
  guide("COMMUNITY", "bot-games", "Panduan Bot Games", "Channel ini untuk fitur fun/game bot.", [
    field("Command fun", list([
      "/meme, /quote, /8ball.",
      "/coinflip, /roll, /trivia, /quiz.",
      "/giveaway jika dibuka admin.",
      "/afk dan /leaderboard jika tersedia.",
    ])),
    field("Etika", "Gunakan secukupnya dan jangan ganggu channel operasional."),
  ], 0x2ecc71),
  guide("COMMUNITY", "social-links", "Panduan Social Links", "Channel ini berisi link sosial resmi HYPERINDO.", [
    field("Keamanan", list([
      "Gunakan hanya link resmi dari channel ini.",
      "Laporkan link palsu lewat #report-problem.",
      "Jangan percaya admin palsu yang DM duluan.",
    ])),
  ], 0x1abc9c),

  guide("STAFF AREA", "admin-chat", "Panduan Admin Store Panel", "Panduan cepat untuk admin/staff menjalankan order, payment, ticket, dan store ops.", [
    field("Entry point admin", list([
      "/admin untuk Admin Store Panel.",
      "/panel untuk home panel sesuai role.",
      "Dashboard web untuk baca data operasional jika akses tersedia.",
    ])),
    field("Tugas harian admin", list([
      "Review payment proof dan approve/reject dengan alasan jelas.",
      "Claim/assign ticket dan update order status.",
      "Pantau queue joki, order bermasalah, dan warranty.",
      "Jaga stock/pricelist tetap sinkron dengan invoice.",
    ])),
    field("Jangan dilakukan", list([
      "Jangan approve payment tanpa bukti valid.",
      "Jangan kirim data sensitif customer ke channel publik.",
      "Jangan refund/dispute tanpa reason dan audit trail.",
    ])),
  ], 0x57f287),
  guide("STAFF AREA", "operator-guide", "Panduan Owner, Admin, dan Operator", "SOP internal untuk kontrol produksi HYPEBOTX.", [
    field("Owner control", list([
      "/owner untuk maintenance, dashboard, backup, whitelist, recovery, security, dan health.",
      "Aksi risiko tinggi wajib reason dan confirm.",
      "Backup dulu sebelum restore, migrasi, atau perubahan struktur besar.",
    ])),
    field("Setup dan channel", list([
      "/setup-panel untuk kirim panel, setup role, audit server, dan struktur.",
      "Gunakan script renew/channel guide hanya saat maintenance terkontrol.",
      "Setelah ubah env/channel ID, restart PM2 dengan update env.",
    ])),
    field("QA wajib", list([
      "npm run test",
      "npm run build",
      "npm run qa:all",
      "npm run qa:live:guild",
      "npm run qa:live:http",
    ])),
  ], 0xf2c94c),
  guide("STAFF AREA", "bot-testing", "Panduan Testing Bot dan Web", "Gunakan channel ini untuk uji fitur sebelum dianggap siap produksi.", [
    field("Test cepat", list([
      "Verify button dan role select.",
      "Order dummy dari #open-ticket.",
      "Upload bukti bayar di ticket.",
      "Admin approve/reject payment.",
      "Set processing, done, close ticket.",
      "Cek dashboard dan audit log.",
    ])),
    field("Command QA terminal", list([
      "npm run test",
      "npm run build",
      "npm run qa:all",
      "npm run qa:staging",
      "npm run qa:live:guild",
      "npm run qa:live:http",
    ])),
    field("Data dummy", "Tandai order dummy sebagai TEST/CANCELLED dan jangan hitung sebagai revenue real."),
  ], 0x9b59b6),
  guide("STAFF AREA", "bug-report", "Panduan Bug Report Staff", "Gunakan format ini agar bug cepat direproduksi dan diperbaiki.", [
    field("Format bug", lines([
      "Judul:",
      "Role/user yang kena:",
      "Channel/ticket/order ID:",
      "Langkah reproduksi:",
      "Expected:",
      "Actual:",
      "Screenshot/log:",
      "Severity: LOW/MEDIUM/HIGH/BLOCKER",
    ])),
    field("Prioritas blocker", list([
      "Bot/web down.",
      "Payment/order salah status.",
      "Ticket terbuka publik.",
      "Data order hilang/duplicate.",
      "Secret/token terlihat.",
    ])),
  ], 0xe74c3c),
  guide("STAFF AREA", "staff-chat", "Panduan Staff Chat", "Channel koordinasi internal staff. Pakai ringkas, jelas, dan mudah ditindaklanjuti.", [
    field("Gunakan untuk", list([
      "Hand-off order antar shift.",
      "Koordinasi masalah customer.",
      "Reminder payment, warranty, atau queue.",
      "Follow-up bug kecil yang tidak butuh report lengkap.",
    ])),
    field("Format hand-off", lines([
      "Order/Ticket:",
      "Status terakhir:",
      "Action berikutnya:",
      "PIC:",
      "Deadline/estimasi:",
    ])),
  ], 0x95a5a6),
];

function buildEmbed(entry) {
  return new EmbedBuilder()
    .setTitle(entry.title)
    .setDescription(entry.description.slice(0, 4096))
    .setColor(entry.color)
    .addFields(entry.fields.slice(0, 25))
    .setFooter({ text: footerText })
    .setTimestamp();
}

function resolveTargetChannel(guild, entry) {
  const categories = guild.channels.cache
    .filter((channel) => channel.type === ChannelType.GuildCategory && categoryMatches(channel, entry.category));

  const candidates = guild.channels.cache.filter((channel) => {
    if (!channel?.isTextBased?.()) return false;
    if (channel.type === ChannelType.GuildCategory) return false;
    if (!channelMatches(channel, entry.channel)) return false;
    if (categories.size > 0) return categories.has(channel.parentId);
    return true;
  });

  const visible = candidates.filter((channel) => !normalizeText(channel.parent?.name).includes("old"));
  return visible.first() || candidates.first() || null;
}

function canSend(channel, botMember) {
  const permissions = channel.permissionsFor(botMember);
  if (!permissions) return { ok: false, detail: "no permission object" };
  const required = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
  ];
  const missing = required.filter((flag) => !permissions.has(flag));
  if (missing.length) {
    return {
      ok: false,
      detail: `missing ${new PermissionsBitField(missing).toArray().join(", ")}`,
    };
  }
  return { ok: true, detail: "ok" };
}

async function findExistingGuideMessage(channel, title, clientUserId) {
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages) return null;
  return messages.find((message) =>
    message.author?.id === clientUserId &&
    message.embeds?.some((embed) => embed.title === title && embed.footer?.text === footerText),
  ) || null;
}

async function publishGuide(client, guild, botMember, entry) {
  const key = normalizeKey(`${entry.category}-${entry.channel}`);
  if (only && !only.has(normalizeKey(entry.channel)) && !only.has(key)) {
    add("skip", `${entry.category}/${entry.channel}`, "SKIP", "--only filter");
    return;
  }

  const channel = resolveTargetChannel(guild, entry);
  if (!channel) {
    add("resolve", `${entry.category}/${entry.channel}`, "WARN", "channel not found");
    return;
  }

  const permission = canSend(channel, botMember);
  if (!permission.ok) {
    add("permission", `${entry.category}/${entry.channel}`, "WARN", permission.detail);
    return;
  }

  const embed = buildEmbed(entry);
  const payload = { embeds: [embed] };

  if (!apply) {
    add("dry-run", `${entry.category}/${entry.channel}`, "PASS", `target=#${channel.name}`);
    return;
  }

  const existing = await findExistingGuideMessage(channel, entry.title, client.user.id);
  if (existing) {
    await existing.edit(payload);
    add("publish", `${entry.category}/${entry.channel}`, "UPDATED", `#${channel.name}`);
  } else {
    await channel.send(payload);
    add("publish", `${entry.category}/${entry.channel}`, "SENT", `#${channel.name}`);
  }
}

function printAndExit(code) {
  const counts = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    version,
    counts,
    results,
  };
  const reportDir = path.join(repoRoot, "logs", "discord-guides");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `send-discord-guides-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.table(results);
  console.log(`Report: ${reportPath}`);
  process.exitCode = code;
}

async function main() {
  const token = envValue("DISCORD_TOKEN");
  const guildId = envValue("GUILD_ID") || envValue("DISCORD_GUILD_ID") || envValue("DASHBOARD_GUILD_ID");

  if (!token) {
    add("env", "DISCORD_TOKEN", "FAIL", "missing");
    printAndExit(1);
    return;
  }
  if (!guildId) {
    add("env", "GUILD_ID", "FAIL", "missing");
    printAndExit(1);
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);

  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.channels.fetch();
    const botMember = await guild.members.fetch(client.user.id);

    add("discord", "bot login", "PASS", client.user.tag);
    add("discord", "guild reachable", "PASS", guild.name);

    for (const entry of guides) {
      await publishGuide(client, guild, botMember, entry);
      if (apply) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  } finally {
    client.destroy();
  }

  const failed = results.some((row) => row.status === "FAIL");
  printAndExit(failed ? 1 : 0);
}

main().catch((error) => {
  add("runtime", "send discord guides", "FAIL", error.message);
  printAndExit(1);
});
