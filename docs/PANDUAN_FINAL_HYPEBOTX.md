# PANDUAN FINAL HYPEBOTX (Update Sprint 2)

Dokumen ini adalah panduan final resmi untuk operasional HYPEBOTX, diperbarui sesuai dengan fitur Automation Priority 1 yang telah mencapai status **CODE DONE** pada Sprint 2.

Untuk detail milestone teknis dan tugas next update, lihat juga: **[docs/ROADMAP.md](docs/ROADMAP.md)**.

---

## 0. NEXT UPDATE & ROADMAP PRIORITAS

### HIGH PRIORITY
- Anti bot liar / server whitelist
- Multi-server hardening
- Backup otomatis
- Database production (SQLite/PostgreSQL)
- Monitoring + alert crash
- Rate limit + anti spam
- Recovery mode kalau JSON corrupt

### MEDIUM PRIORITY
- Dashboard web admin
- Analytics order/ticket/payment
- Export laporan
- Customer history
- Staff performance report
- Payment verification
- Auto status order
- Reminder order pending

### LOW PRIORITY
- Leveling / XP
- Moderation system lengkap
- Docker deployment
- CI/CD pipeline
- Audit dashboard

### TARGET
Jika semua high priority selesai, HYPEBOTX bisa naik dari:
- `A Tier Custom Bot` → `S Tier Production Business Bot`

Fokus utama tetap: **STORE / JOKI / ORDER / PAYMENT / TICKET AUTOMATION**.

---

## 1. FORMAT ORDER ID BARU
Mulai saat ini, seluruh Order ID menggunakan format sekuensial:
* **Format:** `HYP-0001`, `HYP-0002`, `HYP-0003`, dst.
* Jika mencapai `HYP-9999`, otomatis berlanjut ke `HYP-10000`.
* **Backward Compatibility:** Order lama dengan format `ORD-*` tetap terbaca oleh sistem, namun order baru wajib menggunakan `HYP-XXXX`.

---

## 2. MANAJEMEN STOK & PRODUK DIGITAL
Stok sekarang dikelola secara unit per unit (StockUnit) untuk memungkinkan *auto-delivery*.

### Command Stok:
* `/stock-add` - Menambah stok baru.
* `/stock-list` - Melihat daftar stok.
* `/stock-edit` - Mengedit data stok.
* `/stock-remove` - Menghapus stok.
* `/stock-update` - Tetap digunakan untuk pengumuman/update stok ke channel publik.

### Lifecycle Stok:
* `available` -> `reserved` -> `sold` (atau `void`).
* Produk non-digital juga didata sebagai StockUnit per quantity, dengan `valueEncrypted = null`.

---

## 3. AUTO DELIVERY DIGITAL
Sistem kini dapat mengirimkan produk digital langsung ke customer.

### Flow Otomatis:
1. Payment di-approve (status menjadi `paid`).
2. Bot mencari StockUnit yang `available`.
3. Status stok berubah menjadi `reserved`.
4. Bot mengirim produk (key/akun/lisensi) langsung melalui **Direct Message (DM) Customer**.
5. Jika DM berhasil, status stok menjadi `sold`.
6. Jika DM gagal (contoh: DM customer ditutup), status stok otomatis kembali ke `available` dan bot mencatat *alert* kegagalan.

> **PENTING:** Full key/lisensi/akun hanya dikirim via DM. Ticket channel dilarang keras menampilkan *full secret product*. Ticket hanya untuk notifikasi status.

---

## 4. ANTI DUPLICATE & DOUBLE DELIVERY GUARD
Keamanan pengiriman telah ditingkatkan untuk menghindari kerugian ganda.
* **Mencegah Double Delivery:** Order yang sudah `sold` tidak bisa ditrigger ulang untuk pengiriman.
* **Mencegah Race Condition:** Unit stok yang sedang berstatus `reserved` dan terkunci oleh satu `order.id` tidak bisa diproses ganda.
* **Revert Stok:** Jika DM gagal terkirim, stok hanya akan dikembalikan ke `available` jika stok tersebut memang di-*reserve* oleh order yang bersangkutan.

---

## 5. FLOW TIKET, INVOICE & ORDER SUMMARY

### Order Summary (`/order-summary`)
Menampilkan ringkasan pesanan secara real-time.
* Embed diperbarui secara *in-place* (tidak spam embed baru).
* **Isi:** Order ID, Customer, Layanan, Paket/SKU, Total Harga, Status Pembayaran, Status Pesanan, Admin Handler.

### Invoice (`/invoice`)
* Nomor Invoice = Order ID (Contoh: `HYP-0001`).
* Muncul/terupdate saat pembayaran mencapai status `paid`.
* Menggunakan fitur *edit-in-place* sehingga tidak ada duplikat invoice saat order diproses ulang.
* **Payment Paid Hook:** Saat payment disetujui, **Order Summary** dan **Invoice** otomatis ter-refresh bersamaan.

---

## 6. REFUND & DISPUTE FLOW
Untuk menangani komplain atau pengembalian dana.

### Command:
* `/refund`
* `/dispute`

### Status Flow:
1. `requested`
2. `reviewing`
3. `approved`
4. `rejected`

### Syarat Wajib:
* Menyertakan **alasan (reason)**.
* Aksinya tercatat di log admin/staff.
* Data yang direkam: `orderId`, `ticketId`, `customerId`, `handledBy`, `reason`, `status`, `timestamp`.
* Jika status berubah, *Order Summary* dan *Invoice* akan ikut diperbarui jika relevan.

---

## 7. JOKI SYSTEM & HOLD REMINDER

### Joki History (`/joki-history`)
* Pencarian berdasarkan **Order ID** atau **Customer ID**.
* Menampilkan riwayat order joki terbaru.
* **Catatan Penting:** Order Joki dengan status `DONE` **tidak boleh** muncul di antrean aktif (*active queue*). Antrean aktif hanya berisi: `queued`, `processing/work`, dan `hold`.

### HOLD Reminder
* Job otomatis akan mengecek order joki yang berstatus `HOLD`.
* Jika melewati batas waktu (threshold), bot akan mengirim *alert* ke staff/admin agar order tersebut tidak dilupakan.
* Terdapat *cooldown* antispam.

---

## 8. JOB SCHEDULER & OTOMATISASI

Sistem sekarang menjalankan rutinitas otomatis di latar belakang:
1. **Payment Reminder Job:** Mengingatkan customer yang belum membayar pesanannya sebelum batas waktu habis (dengan *cooldown* agar tidak spam).
2. **HOLD Reminder Job:** Mengingatkan staff untuk order joki yang tertahan terlalu lama.
3. **Auto Close Inactive Ticket Job:** Menutup tiket yang ditinggalkan.
   * **Flow:** Deteksi tiket pasif -> Kirim Peringatan -> Tunggu Grace Period -> Tutup Otomatis -> Buat Transcript.
   * **Pengecualian:** Tiket tidak akan ditutup jika sedang *payment pending baru*, ada *refund/dispute aktif*, ada *warranty aktif*, atau joki berstatus *WORK/HOLD*.

---

## 9. KATALOG LAYANAN & HARGA
Command `/price` dan `/setprice` telah ditingkatkan:
* Harga sekarang dikelompokkan berdasarkan **kategori**.
* Mendukung fitur SKU (`sku`), visibilitas (`isActive`), dan urutan (`sortOrder`).
* **Live Stock:** Jika SKU dikaitkan dengan stok digital/fisik, command `/price` akan langsung menampilkan status **In Stock** atau **Out of Stock**.

---

## 10. MAINTENANCE MODE
Digunakan saat sistem butuh pemeliharaan atau ada gangguan.
* **Command:** `/maintenance on|off`
* **Hard Block:** Customer tidak bisa melakukan order, tidak bisa membuat tiket baru, dan tidak bisa melanjutkan pembayaran.
* **Bypass:** Staff dan Owner tetap bisa mengakses seluruh fitur admin.
---

## 11. UTILITAS ADMIN & KEAMANAN
Sistem kini dilengkapi dengan fitur keamanan dan *tools* bantu admin:

### Command Utilitas (Hanya Staff/Admin)
* `/health` - Menampilkan status sistem (*Database*, *Commands*, *Scheduler*, *Log Service*).
* `/export` - Mengekspor data ke file CSV. Terdiri dari *subcommand*: `orders`, `payments`, `joki`, dan `customers`.
* `/guide` - Menampilkan panduan ringkas di chat. Tersedia untuk `admin`, `joki`, dan `customer`.

### Sensitive Data Warning (Keamanan Otomatis)
Sistem secara otomatis mengamankan privasi *customer* dari kelalaian *share* data di *channel* publik.
* **Deteksi:** Bot akan mendeteksi kombinasi email/password, kata kunci password, dan *token/API key* di semua *channel* non-ticket.
* **Aksi:** Pesan yang memuat data sensitif akan langsung **dihapus**. Customer akan diberi peringatan *ephemeral* untuk mengirimkan data tersebut hanya di *channel ticket*.
* **Audit Log:** Staff akan mendapat notifikasi log tanpa menyimpan *plain text password* tersebut.

## 12. PANDUAN PERAN & TANGGUNG JAWAB

### 12.1 Pengguna (Customer)
- Gunakan panel customer untuk:
  - `ORDER` → buat pesanan baru.
  - `CEK PESANAN` → cek status order.
  - `PEMBAYARAN` → unggah bukti transfer di channel ticket order.
  - `BANTUAN ADMIN` → panggil staf bila perlu.
- Semua bukti pembayaran wajib dikirim sebagai gambar di channel ticket order.
- Jangan mengirim data sensitif di channel publik; gunakan channel ticket yang benar.
- Jika ada masalah, laporkan melalui ticket order.

### 12.2 Admin
- Gunakan `/audit-server`, `/send-ticket-panel`, `/send-payment-panel`, `/send-verify-panel`, dan `/send-role-panel` untuk setup dan pengaturan.
- Monitor log channel `order-log`, `payment-log`, `ticket-log`, dan `bot-log` secara rutin.
- Pastikan flow order, payment, joki, dan ticket berfungsi normal.
- Jangan hentikan PM2 bot utama hanya untuk mengeluarkan bot dari server tertentu.
- Gunakan `/guide` bila butuh ringkasan cepat.

### 12.3 Owner
- Utamakan keamanan server utama dan jangan nyalakan dua bot sekaligus.
- Gunakan variabel `ALLOWED_GUILD_IDS` di `.env` untuk membatasi bot hanya pada server yang diizinkan.
- Prosedur start aman:
  1. `pm2 status`
  2. `pm2 stop hypebotx` jika masih ada proses lama
  3. `npm test` (atau `npm run qa:all` untuk pengujian penuh)
  4. `pm2 start ecosystem.config.js`
  5. `pm2 status`
  6. `pm2 logs hypebotx`
- Jangan jalankan bot ganda karena storage masih memakai JSON.
- Jika ingin lepaskan bot dari server tertentu, lakukan tanpa mematikan bot di server utama.

### 12.4 Dev
- Selalu perbarui `.env.example` dengan `ALLOWED_GUILD_IDS`.
- Audit dan pastikan data multi-guild dipisah berdasarkan `guildId` untuk:
  - ticket
  - role
  - panel
  - payment
  - giveaway
  - joki
  - log
- Jalankan `npm test` sebelum deploy; gunakan `npm run qa:all` untuk pemeriksaan penuh.
- Verifikasi bahwa hanya satu instance bot aktif di PM2: `pm2 status`.
- Setelah perubahan konfigurasi, pakai `pm2 restart hypebotx` dan cek `pm2 logs hypebotx`.
- Prioritas sekarang: server 1 tetap aman dan server 2 tidak aktif sampai multi-server siap.

---

## 13. FITUR TRANSAKSIONAL & ENGAGEMENT (BATCH 2)

Sistem kini memiliki fitur tambahan untuk mempermudah transaksional dan meningkatkan engagement pelanggan:

### A. Coupon / Voucher System
Fitur kupon digunakan untuk memberikan potongan harga kepada customer:
* **Command Admin:** `/coupon create`, `/coupon list`, `/coupon disable`.
* Mendukung potongan tipe **persentase** (misal 10%) dan **nominal** (misal Rp20.000).
* Admin dapat mengatur batas pemakaian (*usage limit*), batas waktu (*expired date*), dan minimal pembelian.
* **Command Customer:** `/apply-coupon <code>` (digunakan oleh customer langsung di dalam *channel ticket order* mereka).
* Harga akan dikalkulasi otomatis dan ditampilkan pada *Invoice/Order Summary*.

### B. Testimoni System
Mendapatkan *feedback* dan review jujur dari customer:
* **Auto Prompt:** Begitu order atau joki ditandai sebagai `DONE` (completed), bot akan mengirimkan pesan ucapan terima kasih di tiket bersama tombol **Berikan Testimoni**.
* **Formulir Modal:** Customer dapat mengisi rating (1-5) dan pesan ulasan.
* **Publikasi:** Testimoni akan langsung dipublikasikan secara otomatis ke channel publik `#testimonials` lengkap dengan tautan ke Order ID dan profil pelanggan.

### C. Quick Action Panel
Alat bantu *workflow* yang dikhususkan untuk mempermudah pekerjaan Staff/Admin.
* Panel aksi cepat otomatis disematkan (muncul sebagai tombol di bawah) ketika *Order Summary* pertama kali dikirimkan di dalam tiket.
* Terdiri dari tombol-tombol utama:
  1. **Mark Paid** (Ubah status payment menjadi PAID)
  2. **Mark Processing** (Ubah status order menjadi WORK/PROCESSING)
  3. **Mark Done** (Selesaikan order/joki dan panggil sistem Testimoni)
  4. **Order Summary & Invoice** (Refresh tampilan *embed* ringkasan/faktur order)
  5. **Close Ticket** (Tutup tiket dengan cepat)
* **Keamanan:** Jika tombol ditekan oleh customer atau non-staff, perintah akan ditolak (diblokir) oleh *Permission Guard*.

---

## 13. PANDUAN QA & TROUBLESHOOTING

Jika terjadi masalah selama operasional, periksa hal berikut:
* **Stok Tidak Terkirim:** Pastikan status DM customer tidak dikunci. Jika terkunci, status produk akan kembali ke `available`. Staff harus menghubungi manual.
* **Double Invoice/Summary:** Bot saat ini melakukan *edit-in-place*. Jika masih muncul duplikat, pastikan `orderSummaryMessageId` atau `invoiceMessageId` tersimpan benar di database.
* **Tiket Langsung Tertutup:** Periksa *Auto Close Job*. Pastikan tiket dalam status *WORK/HOLD/Refund/Warranty* terdaftar di sistem sehingga dikecualikan dari pembersihan otomatis.
* **Joki DONE Masih Muncul:** Pastikan command yang menyelesaikan order men-set status ke `DONE` secara spesifik, sehingga dikeluarkan dari queue `/joki-queue`.

---

## 14. SERVER CLEANUP & INFRASTRUCTURE SETUP

Panduan lengkap untuk setup infrastruktur Discord server Hyperindo dengan struktur tim 7 orang dan best practices operasional.

### Target Struktur Tim
- 1 Owner
- 1 Manager  
- 1 Admin
- 1 IT Dev
- 3 Staff Members (including promotor role)

---

### FASE 1: PRE-CLEANUP CHECKLIST

**1.1 Backup Everything**
```bash
# Run backup command
/backup-server

# Verify backup completion
Check logs/backup/ folder for recent backup files
```

**1.2 Document Current State**
```bash
# Generate audit report
/audit-server

# Save the audit file for reference
Download "audit-server-hyperindo.txt"
```

**1.3 Team Coordination**
- Assign roles to team members:
  - Owner: Final approval authority
  - Manager: Oversees cleanup process
  - Admin: Executes technical changes
  - IT Dev: Handles bot and technical issues
  - 3 Staff: Handle content and community management

**1.4 Communication Plan**
- Create temporary `#server-cleanup-announcements` channel
- Announce maintenance window (2-4 hours)
- Set server to maintenance mode

---

### FASE 2: ROLE CLEANUP & SETUP

**2.1 Remove Duplicate Roles**
```bash
# Check for duplicates via audit
/audit-server

# For each duplicate role found:
1. Go to Server Settings → Roles
2. Identify duplicate roles (same name, different colors/permissions)
3. Check which one has more members: keep that one
4. Move all members from duplicate to main role
5. Delete duplicate role
```

**2.2 Create Missing Core Roles**
```bash
/create-role name:"MANAGER" color:"#FF6B6B" permissions:"Manage Server, Manage Roles, Manage Channels"
/create-role name:"ADMIN" color:"#4ECDC4" permissions:"Manage Messages, Kick Members, Ban Members"
/create-role name:"IT DEV" color:"#45B7D1" permissions:"Manage Webhooks, View Audit Log"
/create-role name:"PROMOTOR" color:"#FFA07A" permissions:"Mention Everyone"
```

**2.3 Role Hierarchy (Correct Order)**
```
Server Owner
├── MANAGER (highest admin role)
├── ADMIN
├── IT DEV
├── STAFF
├── PROMOTOR
├── MEMBER
├── CUSTOMER
├── VIP CUSTOMER
├── ENHANCED
├── LEGACY
├── PROMO PING
├── EVENT PING
├── DJ
├── PRAMUGARA
├── PENJOKI
└── UNVERIFIED (lowest)
```

**2.4 Assign Team Roles**
```
OWNER: Assign to server owner
MANAGER: Assign to team leader
ADMIN: Assign to technical admin
IT DEV: Assign to developer
STAFF: Assign to 3 staff members
PROMOTOR: Assign to marketing staff
```

---

### FASE 3: CHANNEL ORGANIZATION

**3.1 Create Required Categories**
```bash
/create-category name:"INFO"
/create-category name:"STORE"
/create-category name:"ORDER"
/create-category name:"COMMUNITY"
/create-category name:"VOICE"
/create-category name:"STAFF"
```

**3.2 Channel Setup by Category**

**INFO Category:**
```bash
/create-channel name:"welcome" category:"INFO" type:"text"
/create-channel name:"rules" category:"INFO" type:"text"
/create-channel name:"announcements" category:"INFO" type:"text"
/create-channel name:"faq" category:"INFO" type:"text"
/create-channel name:"role-select" category:"INFO" type:"text"
/create-channel name:"verify" category:"INFO" type:"text"
```

**STORE Category:**
```bash
/create-channel name:"price-list" category:"STORE" type:"text"
/create-channel name:"promo" category:"STORE" type:"text"
/create-channel name:"stock-update" category:"STORE" type:"text"
/create-channel name:"produk-steam" category:"STORE" type:"text"
/create-channel name:"produk-epic" category:"STORE" type:"text"
/create-channel name:"produk-rockstar" category:"STORE" type:"text"
/create-channel name:"payment-info" category:"STORE" type:"text"
/create-channel name:"payment-proof" category:"STORE" type:"text"
/create-channel name:"testimonials" category:"STORE" type:"text"
/create-channel name:"claim-warranty" category:"STORE" type:"text"
/create-channel name:"🛒・order-panel" category:"STORE" type:"text"
/create-channel name:"📦・status-order" category:"STORE" type:"text"
/create-channel name:"💎・top-up-game" category:"STORE" type:"text"
/create-channel name:"🎮・joki-game" category:"STORE" type:"text"
/create-channel name:"🧑‍💻・jual-akun" category:"STORE" type:"text"
/create-channel name:"⚙️・optimizer-windows" category:"STORE" type:"text"
/create-channel name:"🪟・windows-office-key" category:"STORE" type:"text"
```

**ORDER Category:**
```bash
/create-channel name:"open-ticket" category:"ORDER" type:"text"
/create-channel name:"🎫・open-ticket" category:"ORDER" type:"text"
/create-channel name:"order-status" category:"ORDER" type:"text"
/create-channel name:"support" category:"ORDER" type:"text"
```

**COMMUNITY Category:**
```bash
/create-channel name:"general-chat" category:"COMMUNITY" type:"text"
/create-channel name:"media-share" category:"COMMUNITY" type:"text"
/create-channel name:"gta-discussion" category:"COMMUNITY" type:"text"
/create-channel name:"bot-games" category:"COMMUNITY" type:"text"
/create-channel name:"music-request" category:"COMMUNITY" type:"text"
/create-channel name:"giveaway" category:"COMMUNITY" type:"text"
```

**VOICE Category:**
```bash
/create-channel name:"Public Voice" category:"VOICE" type:"voice"
/create-channel name:"Music Room" category:"VOICE" type:"voice"
```

**STAFF Category:**
```bash
/create-channel name:"staff-chat" category:"STAFF" type:"text"
/create-channel name:"📥・order-masuk" category:"STAFF" type:"text"
/create-channel name:"📋・antrian-joki" category:"STAFF" type:"text"
/create-channel name:"💰・payment-check" category:"STAFF" type:"text"
/create-channel name:"✅・order-selesai" category:"STAFF" type:"text"
/create-channel name:"⚠️・komplain-customer" category:"STAFF" type:"text"
/create-channel name:"📑・staff-log" category:"STAFF" type:"text"
/create-channel name:"order-log" category:"STAFF" type:"text"
/create-channel name:"payment-log" category:"STAFF" type:"text"
/create-channel name:"moderation-log" category:"STAFF" type:"text"
/create-channel name:"ticket-log" category:"STAFF" type:"text"
/create-channel name:"bot-log" category:"STAFF" type:"text"
/create-channel name:"🤖・bot-log" category:"STAFF" type:"text"
/create-channel name:"🛠️・bug-report" category:"STAFF" type:"text"
/create-channel name:"📦・update-bot" category:"STAFF" type:"text"
/create-channel name:"🧪・testing-command" category:"STAFF" type:"text"
/create-channel name:"Staff Voice" category:"STAFF" type:"voice"
```

**3.3 Staff Channel Security**
```bash
# For each STAFF category channel:
1. Right-click channel → Edit Channel
2. Go to Permissions tab
3. Click @everyone role
4. Set "View Channel" to ❌ (deny)
5. Ensure STAFF+ roles have "View Channel" ✓ (allow)
```

---

### FASE 4: BOT MANAGEMENT

**4.1 Bot Permission Audit**
```bash
# Check bot permissions
/bot-permissions

# Required permissions for HYPEBOTX:
- Manage Channels
- Manage Roles
- Manage Messages
- View Audit Log
- Send Messages
- Embed Links
- Attach Files
- Use Slash Commands
- Manage Webhooks
- Connect (voice)
- Speak (voice)
```

**4.2 Bot Configuration**
```bash
# Deploy/update commands
/deploy-commands

# Setup gamestore template
/setup-gamestore

# Setup roles system
/setup-roles

# Send verification panel
/send-verify-panel

# Send role selection panel
/send-role-panel

# Send ticket panel
/send-ticket-panel

# Send payment panel
/send-payment-panel

# Send promo panel
/send-promo-panel
```

---

### FASE 5: POST-CLEANUP VERIFICATION

**5.1 Final Audit**
```bash
# Run audit again
/audit-server

# Verify: Should show "Server OK - Tidak ada masalah yang ditemukan"
```

**5.2 Core Functionality Tests**
- [ ] Verification system working
- [ ] Ticket creation working
- [ ] Role selection working
- [ ] Order panels displaying correctly
- [ ] Staff channels properly secured
- [ ] Bot responding to commands

**5.3 Permission Verification**
- [ ] Regular members cannot see staff channels
- [ ] Staff can access all staff channels
- [ ] Role hierarchy enforced correctly
- [ ] Bot has necessary permissions

---

### FASE 6: MONITORING & MAINTENANCE

**6.1 Backup Strategy**
- Daily automated backups configured
- Manual backups before major changes
- Off-site backup storage
- Periodic backup restoration tests

**6.2 Regular Maintenance**
- Weekly audits: `/audit-server`
- Monthly full health check
- Quarterly inactive member cleanup
- Security updates for dependencies

**6.3 Incident Response**
- **Escalation:** IT Dev → Admin → Manager → Owner
- **Channels:** `#bug-report` for technical issues, `#staff-chat` for operational
- **Documentation:** Maintain updated guides
- **Training:** Regular team training on procedures

**6.4 Success Metrics**
- Audit score: 0 issues
- Bot uptime: 99%+
- Command response: <3 seconds
- Team satisfaction: Positive feedback

---

## 15. KONVENSI & BEST PRACTICES

### Naming Convention
- **Channels:** lowercase dengan dash (kebab-case), emoji diizinkan dengan format `emoji・channel-name`
- **Roles:** UPPERCASE, descriptive names
- **Order IDs:** `HYP-XXXX` format (4 digits)
- **Files/Backups:** `snake_case_YYYY-MM-DD` format

### Communication Standards
- Staff channels: **#staff-chat** untuk diskusi internal
- Bug reports: **#bug-report** untuk issue tracking
- Logs: Channeled ke masing-masing kategori log
- Public announcements: **#announcements** untuk general audience

### Security Best Practices
- Jangan pernah share full product keys di public channels
- Sensitive data hanya dikirim via DM atau private ticket
- Bot log menyimpan bukti tapi tidak plaintext password
- Regular audit untuk mencegah data leakage

---

*Dokumen ini merupakan sumber kebenaran (Source of Truth) terakhir untuk alur kerja bot dan infrastruktur server pasca Sprint 2.*
