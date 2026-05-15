# HYPEBOTX Discord Bot

Workspace ini sudah disatukan menjadi satu folder bot utama. Runtime aktif memakai struktur CommonJS dari bot GameStore yang lebih lengkap, sedangkan bot HYPEBOTX ESM lama disimpan utuh di `legacy/hypebotx-esm` sebagai sumber porting fitur bertahap.

> **PENTING:** Untuk melihat ringkasan fitur terbaru dan panduan lengkap operasional (Sprint 2 / Priority 1 Automation), silakan baca: **[PANDUAN FINAL HYPEBOTX](PANDUAN_FINAL_HYPEBOTX.md)**.
>
> Untuk roadmap teknis dan rencana next update, buka: **[docs/ROADMAP.md](docs/ROADMAP.md)**.

Lihat `AUDIT_MERGE_REPORT.md` untuk ringkasan audit dan keputusan merge awal.

Bot ini dibuat khusus untuk server GameStore dengan fokus pada:

- setup server otomatis
- struktur channel rapi
- role system sederhana
- verify member
- ticket dan order flow
- payment info
- logging terpisah
- moderasi basic
- hiburan ringan
- musik basic
- backup dan audit server

## Stack

- `discord.js v14`
- slash commands
- button dan select menu
- JSON storage untuk backup, ticket, order, giveaway, dan leaderboard di `src/storage`

## Struktur Project

- `src/commands` untuk slash command
- `src/events` untuk event Discord
- `src/services` untuk logika utama
- `src/components` untuk button, select, dan modal
- `src/templates` untuk template server dan role
- `src/storage` untuk backup, transcript, dan temp data
- `docs` untuk brief dan flow internal

## Fitur Yang Sudah Disiapkan

### Prioritas 1

- `/setup-gamestore`
- `/setup-basic`
- `/setup-roles`
- `/rapihin`
- `/rename-channels`
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
