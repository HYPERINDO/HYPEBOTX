# HYPEBOTX Roadmap Prioritas

Dokumen ini merinci milestone teknis untuk next update HYPEBOTX, khususnya fokus pada high-priority dan target produksi.

## Tujuan Utama

Jika semua high priority selesai, HYPEBOTX dapat naik dari:
- `A Tier Custom Bot` → `S Tier Production Business Bot`

Fokus utama:
- STORE
- JOKI
- ORDER
- PAYMENT
- TICKET AUTOMATION

---

## High Priority

### 1. Anti bot liar / server whitelist
- Implementasi `ALLOWED_GUILD_IDS` di konfigurasi dan `.env`.
- Blokir semua event/interaksi dari guild yang tidak diizinkan.
- Tambahkan validasi pada setiap event penting: command, button, modal, select menu.
- Buat endpoint atau admin command untuk memeriksa `guildId` aktif.
- Uji dengan bot/servidor dummy untuk memastikan bot tidak merespon guild non-whitelist.

### 2. Multi-server hardening
- Audit semua data storage dan pastikan setiap entitas memiliki `guildId`.
- Refactor repository JSON untuk menyimpan data terpisah per guild, misalnya: `orders[guildId]`, `tickets[guildId]`.
- Pastikan service, command, dan job menerima `guildId` dan hanya memproses data guild tersebut.
- Pisahkan konfigurasi server otomatis: role template, panel template, channel log, dan job scheduler.
- Tambahkan integrasi `GUILD_ID` default untuk register command cepat sambil tetap mendukung multi-guild.

### 3. Backup otomatis
- Buat job jadwal otomatis untuk backup JSON/SQLite ke `src/storage/backups`.
- Backup harian/periodik: simpan timestamp, jenis backup, dan checksum.
- Tambahkan mekanisme rollback sederhana: `restoreBackup(file)`.
- Log hasil backup ke channel log internal atau file log.
- Uji dengan skenario `backup -> corrupt data -> restore`

### 4. Database production (SQLite/PostgreSQL)
- Tambahkan dukungan opsi database produksi di config (`sqlite` / `postgres`).
- Refactor database layer untuk abstraksi storage:
  - `read(table, fallback)`
  - `write(table, data)`
  - `update(table, key, mutator)`
- Implementasi SQLite storage awal di `src/storage/database.db`.
- Siapkan adapter Postgres untuk environment production.
- Tambahkan migrasi schema dan loader config database.
- Pastikan fitur backup tetap kompatibel dengan dua mode.

### 5. Monitoring + alert crash
- Tambahkan service monitoring internal: health endpoint, uptime, error rate.
- Buat alert jika proses PM2 restart/crash.
- Tambahkan logger ke Discord/webhook saat terjadi unhandled rejection / uncaught exception.
- Buat command/video `health` yang melaporkan status DB, queue, scheduler, dan cache.
- Tambahkan dashboard sederhana untuk monitoring jika perlu.

### 6. Rate limit + anti spam
- Tambahkan rate limiter pada interaction handler per user/guild/command.
- Pastikan batas default ada untuk command customer, order, payment, dan joki.
- Perkuat anti-spam pada channel ticket/order:
  - block duplicate order spamming
  - block terlalu banyak file/image dalam satu menit
  - block tindakan mass mention / link spam
- Log rate limit triggers ke admin channel.

### 7. Recovery mode kalau JSON corrupt
- Tambahkan deteksi corrupt JSON di database layer.
- Jika parse error terjadi, gunakan fallback backup sementara dan aktifkan mode recovery.
- Buat log error khusus dan peringatan admin.
- Tambahkan command untuk repair/verify data: `/repair-data`.
- Uji kasus JSON corrupt dengan backup dan restore otomatis.

---

## Medium Priority

### 8. Dashboard web admin
- Rencanakan UI/UX sederhana untuk status order, ticket, payment, dan joki.
- Backend minimal bisa pakai Express + template engine atau Next.js.
- Autentikasi admin via role/secret token.
- Tampilkan ringkasan real-time dari data bot.

### 9. Analytics order/ticket/payment
- Tambah repository untuk summary analytics: daily order, revenue, payment success rate.
- Buat job/command `analytics` untuk generate laporan.
- Tampilkan grafik/trend di dashboard admin.

### 10. Export laporan
- Tambah command admin `/export` untuk CSV/JSON.
- Sertakan export order, payment, joki, dan customer history.
- Buat file export disimpan di `src/storage/backups`.

### 11. Customer history
- Simpan riwayat order/payment/ticket per customer.
- Tampilkan via command admin `/customer-profile`.
- Tambahkan filter riwayat berdasarkan guild, tanggal, dan status.

### 12. Staff performance report
- Rekam aktivitas staff: handle order, close ticket, approve payment.
- Buat laporan kinerja per staff per periode.
- Tampilkan di dashboard / command admin.

### 13. Payment verification
- Implementasi status payment lebih lengkap: `pending`, `paid`, `failed`, `manual-review`.
- Tambah alur verifikasi manual bagi admin.
- Tautkan pembayaran ke order otomatis.

### 14. Auto status order
- Buat rule auto-update order status berdasarkan payment/ticket/joki progress.
- Contoh: `pending` → `paid` → `processing` → `completed`.
- Pastikan status otomatis tercatat di log dan customer diberi notifikasi.

### 15. Reminder order pending
- Tambah job pengingat order `pending`/`awaiting payment`.
- Kirim notifikasi ke staff/admin untuk follow-up.
- Kirim reminder customer jika belum bayar setelah X jam.

---

## Low Priority

### 16. Leveling / XP
- Tambah sistem poin/XP untuk customer/staff.
- Integrasi dengan reward/giveaway.

### 17. Moderation system lengkap
- Kembangkan modul moderasi untuk warn, mute, kick, ban, dan auto-moderasi.
- Tambah audit log untuk tindakan moderasi.

### 18. Docker deployment
- Siapkan `Dockerfile` dan `docker-compose.yml` untuk dev/prod.
- Pastikan konfigurasi database dan volume backup bisa di-mount.

### 19. CI/CD pipeline
- Tambah workflow GitHub Actions / pipeline untuk test, lint, dan deploy.
- Eksekusi `npm test` serta validasi `pm2` config.

### 20. Audit dashboard
- Buat dashboard audit untuk review role, channel, permission, dan log.
- Tampilkan status compliance multi-server.

---

## Rekomendasi Pelaksanaan

1. Selesaikan semua item high priority sebelum mulai medium.
2. Prioritaskan stabilitas data dan multi-guild sebelum dashboard/analytics.
3. Gunakan feature branches per tema besar: `hardening`, `database`, `monitoring`, `backup`, `recovery`.
4. Jaga dokumentasi tetap sinkron di `README.md`, `PANDUAN_FINAL_HYPEBOTX.md`, dan `docs/ROADMAP.md`.
