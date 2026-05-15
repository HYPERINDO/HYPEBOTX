# HYPEBOTX Discord Bot

> **LOCAL RELEASE READY** - HYPEBOTX Discord Bot untuk GameStore server management, ticket system, dan order processing.

## 📊 Project Status

- ✅ **LOCAL RELEASE READY**
- ✅ **AUTOMATED VALIDATION PASS**
- ✅ **RUNTIME CLEAN**
- ✅ **JSON STORAGE ENABLED**
- ✅ **PM2 SINGLE INSTANCE**
- ✅ **GITHUB REPO READY**
- 🔄 **WAITING MANUAL LIVE DISCORD TEST**

## 🚀 Features

### Core Features
- **Verify/Member Gate** - Sistem verifikasi member dengan role otomatis
- **Ticket System** - Pembuatan, claim, close ticket dengan transcript
- **Order/Customer Management** - Sistem order dan customer data
- **Stock Management** - Add, list, remove stock items
- **Coupon System** - Apply dan manage coupon codes
- **FAQ System** - Command FAQ untuk informasi umum
- **Price List** - Display harga produk dan layanan
- **Music/Voice** - Join, play, stop, leave voice channel
- **Audit System** - Logging dan monitoring aktivitas
- **Rate Limit** - Anti-spam untuk button clicks
- **Anti-Spam** - Protection terhadap spam messages

### Technical Features
- **Discord Environment Verification** - Validasi role dan channel IDs
- **JSON Local Storage** - Persistent data storage tanpa database
- **PM2 Local Hosting** - Process management untuk production
- **Single Instance Lock** - Prevent multiple bot instances

## 📋 Requirements

- **Node.js** >= 20.0.0
- **npm** (comes with Node.js)
- **PM2** (global install: `npm install -g pm2`)
- **Discord Bot Token** (dari Discord Developer Portal)
- **CLIENT_ID** (dari Discord Developer Portal)
- **GUILD_ID** (ID server Discord target)
- **Role/Channel IDs** (dari server Discord target)

## 🛠️ Installation

```bash
# Clone repository
git clone https://github.com/HYPERINDO/HYPEBOTX.git
cd HYPEBOTX

# Install dependencies
npm ci
```

## ⚙️ Environment Setup

1. **Copy environment template:**
   ```bash
   copy .env.example .env
   ```

2. **Fill in the required values in `.env`:**

   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here

   # Ticket System IDs
   TICKET_CATEGORY_ID=your_ticket_category_id
   MEMBER_ROLE_ID=your_member_role_id
   VERIFIED_ROLE_ID=your_verified_role_id
   VERIFIED_ROLE_IDS=role_id_1,role_id_2,role_id_3
   VERIFY_ROLE_ID=your_verify_role_id
   OWNER_ROLE_ID=your_owner_role_id
   STAFF_ROLE_ID=your_staff_role_id
   TICKET_LOG_CHANNEL_ID=your_ticket_log_channel_id
   TRANSCRIPT_CHANNEL_ID=your_transcript_channel_id

   # Optional: OpenAI Integration
   OPENAI_API_KEY=your_openai_api_key_here

   # Storage Configuration
   STORAGE_PROVIDER=json
   DATA_DIR=./data
   DATABASE_DIR=./data

   # PM2 Configuration
   PM2_INSTANCES=1
   ```

   **Note:** `VERIFY_ROLE_ID` boleh kosong kalau `VERIFIED_ROLE_ID` adalah role utama.

## 🔍 Discord Environment Verification

Jalankan verifikasi environment Discord:

```bash
npm run verify:discord-env
```

**Expected Output:**
```
✅ TICKET_CATEGORY_ID OK
✅ MEMBER_ROLE_ID OK
✅ STAFF_ROLE_ID OK
✅ OWNER_ROLE_ID OK
✅ VERIFIED_ROLE_ID OK
✅ TICKET_LOG_CHANNEL_ID OK
✅ TRANSCRIPT_CHANNEL_ID OK
```

## ▶️ Running the Bot

### Development Mode
```bash
npm start
```

### Production Mode (PM2)
```bash
# Start bot
pm2 start ecosystem.config.js

# Restart with environment update
pm2 restart ecosystem.config.js --update-env

# View logs
pm2 logs hypebotx --lines 100 --nostream

# Check status
pm2 describe hypebotx
```

**Expected PM2 Status:**
- Status: `online`
- Exec Mode: `fork`
- Instances: `1`

## 💾 JSON Storage Rules

> **PENTING:** Bot ini menggunakan JSON storage lokal yang TIDAK thread-safe.

- ✅ Storage masih JSON (tidak database)
- ✅ **Hanya boleh single instance** (PM2_INSTANCES=1)
- ❌ Jangan gunakan cluster mode
- ❌ Jangan jalankan dua process bot bersamaan
- ❌ Jangan commit folder `data/`
- ✅ **Wajib backup data** sebelum maintenance

## 🔄 Backup & Restore

### Automated Backup
```bash
npm run backup:data
```

### Manual Backup (PowerShell)
```powershell
Compress-Archive -Path .\data\* -DestinationPath ".\backup-data-$(Get-Date -Format yyyy-MM-dd-HHmm).zip"
```

### Restore Test
1. Extract backup ke folder `data-test`
2. Run bot dengan `DATA_DIR=./data-test`
3. Pastikan bot bisa baca data existing

## 🧪 Testing & Validation

Jalankan semua validasi:

```bash
# Unit tests
npm test

# Security audit
npm run audit

# QA staging tests
npm run qa:staging

# Discord environment check
npm run verify:discord-env

# PM2 logs check
pm2 logs hypebotx --lines 100 --nostream
```

**Expected Results:**
- ✅ `npm test` - 64/64 PASS
- ✅ `npm run audit` - 0 vulnerabilities
- ✅ `npm run qa:staging` - 4/4 PASS
- ✅ `pm2 logs` - Clean (no errors)

## 🎯 Live Discord Test Checklist

Test manual di server Discord live:

- [ ] **Verify Button** - Klik verify, dapat role verified
- [ ] **Verified User** - Bisa open ticket
- [ ] **Non-Verified User** - Ditolak open ticket
- [ ] **Staff/Owner Bypass** - Bisa open ticket tanpa verify
- [ ] **Open Ticket** - Buat ticket baru berhasil
- [ ] **Claim Ticket** - Staff claim ticket berhasil
- [ ] **Close Ticket** - Close ticket dengan confirm
- [ ] **Transcript Generate** - Transcript otomatis generate
- [ ] **Ticket Log** - Log masuk ke channel log
- [ ] **Price Command** - `/price` show harga
- [ ] **FAQ Command** - `/faq` show informasi
- [ ] **Stock Management** - Add/list/remove stock
- [ ] **Coupon Apply** - Apply coupon code
- [ ] **Add Order** - Customer add order
- [ ] **Customer Set** - Set customer info
- [ ] **Music Commands** - Join/play/stop/leave voice
- [ ] **Rate Limit** - Spam click button ditolak
- [ ] **Anti-Spam** - Spam message ditolak

## ✅ Go-Live Criteria

**GO-LIVE APPROVED FOR LOCAL HOSTING** hanya kalau semua criteria terpenuhi:

- ✅ `npm test` PASS (64/64)
- ✅ `npm run audit` PASS (0 vulnerabilities)
- ✅ `npm run qa:staging` PASS (4/4)
- ✅ `npm run verify:discord-env` PASS
- ✅ PM2 status `online`
- ✅ PM2 exec_mode `fork`
- ✅ PM2 instances `1`
- ✅ PM2 logs clean (no errors)
- ✅ `.env` role/channel IDs valid
- ✅ JSON backup done
- ✅ Manual live Discord test PASS
- ✅ `.env` tidak ke-commit
- ✅ `data/`, `logs/`, `backup/` tidak ke-commit

## 🔒 Git & Security Rules

### ❌ JANGAN Push Files Ini:
- `.env`
- `.env.local`
- `data/`
- `logs/`
- `backup/`
- `node_modules/`
- `bot.lock`
- `*.lock`
- `scratch_*.js`
- `test-output*.txt`
- `*.log`

### ✅ Aman Push Files Ini:
- `src/`
- `scripts/`
- `tests/`
- `tools/`
- `assets/`
- `docs/`
- `.github/`
- `package.json`
- `package-lock.json`
- `.env.example`
- `.env.priority-features.example`
- `.gitignore`
- `.dockerignore`
- `.nvmrc`
- `ecosystem.config.js`
- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.staging.yml`
- `README.md`

## 🤖 Discord Developer Portal Checklist

Pastikan di [Discord Developer Portal](https://discord.com/developers/applications):

### Bot Permissions
- [ ] **SERVER MEMBERS INTENT** aktif (untuk cek member/role)
- [ ] **MESSAGE CONTENT INTENT** aktif (untuk anti-spam/message reading)

### OAuth2
- [ ] Scope: `bot`
- [ ] Scope: `applications.commands`

### Bot Permissions (Integer)
Invite link permission sesuai fitur yang digunakan.

## 📊 Dashboard Plan

Dashboard lokal untuk monitoring (rencana future):

- **Host**: `127.0.0.1` (local only)
- **Port**: `3001`
- **Access**: Owner/Admin only
- **Security**: Jangan tampilkan token, jangan public

### MVP Features:
- Bot status monitor
- PM2 status display
- Logs viewer dengan filter
- Config checker (SET/MISSING)
- JSON backup button
- Ticket monitor real-time
- Order/Stock monitor

## 📦 EXE Plan

Bot bisa dibuat `.exe` untuk distribusi mudah, tapi awalnya launcher dulu.

**JANGAN embed sensitive data:**
- ❌ `DISCORD_TOKEN`
- ❌ `OPENAI_API_KEY`
- ❌ `.env` files
- ❌ JSON data files
- ❌ `logs/`
- ❌ `backup/`

## 🔧 Troubleshooting

### Ticket Tidak Jalan
1. Cek `TICKET_CATEGORY_ID` di `.env`
2. Pastikan bot punya permission `Manage Channels`
3. Cek PM2 logs: `pm2 logs hypebotx`

### Environment Tidak Terbaca
1. Pastikan `.env` di root folder
2. Restart bot: `pm2 restart ecosystem.config.js --update-env`
3. Cek variable: `pm2 show hypebotx`

### Command Load Failed
1. Cek syntax error: `npm run lint`
2. Cek file path di `src/commands/`
3. Restart bot dengan clean restart

### PM2 Log Error Lama
1. Clear logs: `pm2 flush hypebotx`
2. Restart: `pm2 restart ecosystem.config.js`
3. Monitor: `pm2 logs hypebotx --lines 50`

### .env Sengaja Staged
1. Unstage: `git reset .env`
2. Pastikan di `.gitignore`
3. Jangan commit `.env`

### JSON Backup Issues
1. Pastikan bot stopped sebelum backup
2. Cek file permissions di `data/`
3. Test restore di environment terpisah

## 📋 Final Release Notes

### ✅ Completed:
- GitHub push DONE
- Branch `main` (migrated from `master`)
- Sensitive files properly excluded
- Runtime clean validation
- Security audit pass (0 vulnerabilities)
- Unit tests pass (64/64)
- QA staging pass (4/4)
- Discord environment sync pass
- PM2 single instance configured

### 🔄 Pending:
- Manual Discord live test (final approval step)

### 🎯 Final Approval Criteria:
**GO-LIVE APPROVED FOR LOCAL HOSTING** kalau:
- ✅ Manual Discord live test PASS
- ✅ PM2 logs tetap clean setelah testing
- ✅ Semua Go-Live Criteria terpenuhi

---

**HYPEBOTX** - Local hosting ready Discord bot untuk GameStore server management.
- `/sort-channels`
- `/audit-server`
- `/send-verify-panel`
- `/send-role-panel`
- `/send-ticket-panel`
- `/open-order`
- `/close-order`
- `/claim-ticket`
- `/close-ticket`
- `/set-order-status`
- `/send-payment-panel`
- `/send-promo-panel`
- verify flow dengan tombol
- self role dengan select menu
- ticket system dengan nomor otomatis
- transcript ticket
- logging channel per fungsi

### Prioritas 2

- `/backup-structure`
- `/restore-structure`
- audit struktur dan permission
- anti spam
- anti flood
- anti link scam
- anti mass mention
- filter kata
- timeout ringan
- log join dan leave

### Prioritas 3

- `/meme`
- `/quote`
- `/8ball`
- `/coinflip`
- `/roll`
- `/trivia`
- `/quiz`
- `/giveaway`
- `/afk`
- `/leaderboard`
- `/play`
- `/pause`
- `/resume`
- `/skip`
- `/stop`
- `/queue`
- `/nowplaying`
- `/volume`
- `/loop`
- `/leave`

## Next Update: Prioritas Utama

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

## Struktur Template GameStore

- `INFO`
  - `welcome`
  - `rules`
  - `announcements`
  - `faq`
  - `role-select`
  - `verify`
- `STORE`
  - `price-list`
  - `promo`
  - `stock-update`
  - `produk-steam`
  - `produk-epic`
  - `produk-rockstar`
  - `payment-info`
  - `payment-proof`
  - `testimonials`
  - `claim-warranty`
- `ORDER`
  - `open-ticket`
  - `order-status`
  - `support`
- `COMMUNITY`
  - `general-chat`
  - `media-share`
  - `gta-discussion`
  - `bot-games`
  - `music-request`
  - `giveaway`
- `VOICE`
  - `public-voice`
  - `music-room`
- `STAFF`
  - `staff-chat`
  - `order-log`
  - `payment-log`
  - `moderation-log`
  - `ticket-log`
  - `bot-log`
  - `staff-voice`

## Setup

1. Install Node.js 20+.
2. Install dependency:

```powershell
npm install
```

3. Salin env:

```powershell
Copy-Item .env.example .env
```

4. Isi `.env`:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `ALLOWED_GUILD_IDS` (pisahkan dengan koma jika lebih dari satu)
- `ROLE_TEMPLATE_STRICT=true` (agar setup role hanya sinkron role yang diizinkan)
- `ROLE_TEMPLATE_ALLOWED_NAMES` (daftar role server aktif, pisahkan dengan koma)
- info payment

5. Invite bot dengan permission minimal:

- `Manage Channels`
- `Manage Roles`
- `Manage Messages`
- `Moderate Members`
- `Read Message History`
- `Use Application Commands`
- `Connect`
- `Speak`

6. Jalankan bot:

```powershell
npm start
```

## Catatan Penting

- Pastikan hanya satu instance bot aktif karena storage masih menggunakan JSON.
- Untuk live bot, gunakan `pm2 status` dan `pm2 stop hypebotx` bila proses lama masih berjalan.
- Jalankan `npm test` sebelum deploy. Untuk pengujian lebih lengkap gunakan `npm run qa:all`.
- Saat start pakai PM2:
  - `pm2 start ecosystem.config.js`
  - `pm2 status`
  - `pm2 logs hypebotx`
- `ALLOWED_GUILD_IDS` di `.env` akan membatasi bot hanya ke server yang diizinkan.
- Slash command akan disinkron ke `GUILD_ID` bila diisi.
- Sistem backup restore dibuat aman: restore hanya membuat atau memperbarui struktur, tidak menghapus channel ekstra.
- Sistem musik memakai `@discordjs/voice` dan `play-dl`, jadi environment produksi sebaiknya punya koneksi yang stabil.
- Template custom sederhana bisa dibuat dengan mengedit [gamestoreTemplate.js](/f:/bot%20discord/src/templates/gamestoreTemplate.js), [basicTemplate.js](/f:/bot%20discord/src/templates/basicTemplate.js), dan [communityTemplate.js](/f:/bot%20discord/src/templates/communityTemplate.js).
- Environment kerja ini belum punya `node` dan `npm`, jadi saya belum bisa menjalankan bot langsung di mesin ini.

## Panduan Peran Singkat

### Pengguna / Customer
- Gunakan panel `ORDER`, `CEK PESANAN`, `PEMBAYARAN`, dan `BANTUAN ADMIN` di menu customer.
- Kirim bukti pembayaran sebagai gambar di channel ticket order.
- Jangan bagikan data sensitif di channel publik.

### Admin
- Gunakan command setup dan panel untuk memperbarui verifikasi, ticket, payment, dan role.
- Monitor channel log `order-log`, `payment-log`, `ticket-log`, dan `bot-log`.
- Pastikan customer flow dan joki flow berjalan lancar.

### Owner
- Prioritaskan keamanan server utama; jangan jalankan bot ganda.
- Set `ALLOWED_GUILD_IDS` di `.env` untuk menonaktifkan server yang belum siap.
- Lakukan backup sebelum maintenance.

### Dev
- Perbarui `.env.example` jika menambahkan konfigurasi baru seperti `ALLOWED_GUILD_IDS`.
- Audit multi-guild config untuk ticket, role, panel, payment, giveaway, joki, dan log.
- Jalankan `npm test` sebelum deploy; untuk pengecekan penuh gunakan `npm run qa:all`.
- Verifikasi PM2 dengan `pm2 status` dan `pm2 logs hypebotx`.

## Catatan Payment (2026-05-12)

- **Metode pembayaran yang diterima**: `BCA`, `BRI`, `DANA`, `SHOPEEPAY` saja.
- **Pembayaran hanya dengan upload bukti gambar**:
  - Customer cukup kirim **screenshot/foto (gambar)** bukti transfer langsung di **channel ticket order**.
  - Input teks/catatan (kalau ada) tidak disimpan pada bukti pembayaran—**fokus hanya gambar**.

## Verifikasi Fitur (Ringkasan)

> Catatan: “smoke test” = test otomatis yang dijalankan lewat `npm test`, bukan verifikasi live Discord.

### Sudah tervalidasi (melalui test suite)
- Verify flow (tombol): `/send-verify-panel`
- Ticket flow: nomor otomatis + create/claim/close/reopen + transcript
- Moderation: anti-spam, anti-flood, anti-link scam, anti-mass-mention, filter kata, timeout ringan
- Payment: panel + proof gambar (bukti hanya gambar)
- Joki: queue/status termasuk mekanisme selesai (`done`/`terbang`) via command/trigger terkait

### Ada implementasi, tapi belum ada smoke test spesifik
- Self role (select menu): ada di flow/template (`role-select`), namun belum ada test kasus terpisah untuk select menu.
- Logging channel per fungsi: logging call ada di service, namun belum ada test yang memverifikasi channel target secara live.
- Audit struktur & permission: command/service audit ada, namun belum ada test yang memvalidasi output audit secara langsung.

### Mekanisme tambahan dari permintaan kamu
- **Antiran ketahuan selesai**:
  - Jika **admin/staff** chat di **channel ticket ORDER** berisi `joki done` atau `joki sudah terbang` (termasuk `joki sudah terbang (cicilan)`), sistem mengubah status menjadi **completed** dan mengirim pesan `[JOKI] ...`.
