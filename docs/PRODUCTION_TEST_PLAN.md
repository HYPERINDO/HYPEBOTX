# HYPEBOTX Full Production Test Plan

## Overview
Dokumen ini adalah panduan lengkap untuk QA dan peluncuran HYPEBOTX ke production. Ikuti setiap langkah secara berurutan dan catat hasilnya pada setiap bagian.

## 0. PRE-TEST SAFETY
- Backup `data/`
- Backup `.env`
- Pastikan `.env` tidak masuk git
- Catat branch aktif
- Catat commit terakhir
- Catat status PM2
- Stop bot utama

Command:
```bash
pm2 stop hypebotx
pm2 status
git status --short --branch
```

## 1. BASELINE REPOSITORY CHECK
- Branch harus `main`
- Working tree bersih atau perubahan tercatat
- `origin/main` sinkron
- `package-lock` tidak rusak
- Dependency install bersih

Command:
```bash
git pull --ff-only origin main
npm ci
```

## 2. CONFIG & ENV CHECK
- `DISCORD_TOKEN` ada
- `CLIENT_ID` ada
- `GUILD_ID` ada
- Role ID valid
- Channel ID valid
- Ticket category valid
- Transcript channel valid
- Log channel valid
- OpenAI key optional sesuai fitur AI
- Storage driver JSON benar
- PM2 instance harus 1

Command:
```bash
npm run verify:discord-env
```

## 3. COMMAND REGISTRY TEST
- 100/100 command file valid
- 100 nama command unik
- Semua command bisa di-load
- Semua command sync ke guild
- Tidak ada duplicate command
- Tidak ada deprecated command ikut deploy
- Alias `/ask` dan `/ai` tidak bentrok

Kategori wajib:
- admin 35
- customer 10
- fun 10
- joki 5
- music 10
- setup 10
- store 8
- structure 7
- ticket 4
- root/admin-priority 1

## 4. FULL SLASH COMMAND SMOKE TEST
Test semua 100 command satu per satu.

Untuk setiap command cek:
- bisa dipanggil
- tidak crash
- reply muncul
- error message aman
- command sensitif ephemeral
- command publik tidak bocor data
- log tercatat
- permission guard jalan
- input invalid ditolak aman

## 5. PERMISSION MATRIX TEST
Role yang wajib dites:
- owner
- admin
- staff
- penjoki
- customer verified
- customer non-verified
- public/no role
- banned/blacklisted user

Cek:
- owner bisa akses owner/admin
- admin bisa akses admin sesuai scope
- staff tidak bisa akses owner command
- penjoki hanya akses fitur joki yang relevan
- customer hanya akses fitur customer
- non-verified ditolak untuk fitur wajib verified
- public tidak bisa pakai command sensitif

## 6. ORDER FLOW TEST
Test order:
- Joki
- GTA Legacy
- GTA Enhanced
- Top Up
- Windows
- Office
- Steam Account
- Epic Account
- Rockstar Account
- Custom order jika ada

Setiap flow cek:
- pilih layanan
- isi form
- validasi form
- pilih pricelist/paket
- summary muncul
- confirm
- ticket/thread dibuat setelah confirm
- invoice muncul
- payment status benar
- admin bisa proses
- selesai/closed

## 7. ORDER STATE MACHINE TEST
Test transisi:
- `DRAFT` → `CONFIRMED`
- `CONFIRMED` → `WAITING_PAYMENT`
- `WAITING_PAYMENT` → `PAID`
- `PAID` → `PROCESSING`
- `PROCESSING` → `DONE`
- `DONE` → `CLOSED`

Test status tambahan:
- `CANCELLED`
- `EXPIRED`
- `FAILED`
- `REFUND`
- `HOLD`
- `SKIPPED`

Pastikan tidak ada status nyangkut.

## 8. PAYMENT SYSTEM TEST
Test:
- approve payment
- reject payment
- double approve
- double reject
- approve oleh staff lain
- payment tanpa order
- payment proof kosong
- payment proof invalid
- payment expired
- invoice update
- payment log
- audit log
- tombol approve disabled setelah approve
- klik kedua ditolak server-side

## 9. AUTO QUEUE JOKI TEST
Test:
- Joki normal auto masuk queue
- GTA Legacy auto masuk queue
- GTA Enhanced auto masuk queue
- formType `joki` valid
- formType `gta` valid
- `queueOrderId` tidak null
- `addToQueue = 1`
- customer yang masuk queue, bukan staff
- nomor antrian urut
- queue-list channel update

## 10. QUEUE MANAGEMENT TEST
Test:
- assign penjoki
- unassign penjoki
- mark progress
- mark done
- quick action mark done
- cancel keluar queue
- refund keluar queue
- hold
- skipped
- reorder antrian
- estimasi selesai
- catatan admin
- queue history
- queue-list refresh otomatis
- backend dan tampilan channel sinkron

## 11. AUTO DELIVERY TEST
Test produk digital:
- Windows
- Office
- Steam account
- Epic account
- Rockstar account

Cek:
- stok berkurang
- delivery terkirim
- delivery log tercatat
- order otomatis completed setelah delivery sukses
- order tidak completed kalau delivery gagal
- customer menerima info sesuai format
- data akun/token tidak bocor publik

## 12. TICKET SYSTEM TEST
Test:
- open ticket
- duplicate ticket prevention
- claim ticket
- unclaim ticket
- close ticket
- confirm close
- cancel close
- transcript generate
- transcript channel log
- ticket log
- ticket permission
- ticket category invalid
- channel delete manual
- ticket recovery
- panel ticket tidak dobel
- tombol ticket tidak terlalu ramai

## 13. ADMIN TOOL TEST
Test:
- manage order
- manage payment
- manage queue
- manage stock
- manage coupon
- manage pricelist
- manage ticket
- manage user
- view logs
- setup tools
- emergency/off command jika ada
- admin action log tercatat

## 14. OWNER TOOL TEST
Test:
- setup system
- setup role
- setup channel
- edit config
- dangerous command guard
- reset command
- backup command
- shutdown/restart/off command jika ada
- maintenance mode jika ada
- hanya owner yang bisa akses

## 15. CUSTOMER COMMAND TEST
Test:
- price
- faq
- order
- `/ask`
- `/ai`
- status order
- invoice
- support
- testimoni
- account info
- refund question
- warranty question

## 16. AI FEATURE TEST
Test:
- `/ask`
- `/ai`
- pertanyaan order
- pertanyaan payment
- pertanyaan invoice
- pertanyaan queue
- pertanyaan refund
- pertanyaan warranty
- pertanyaan stock
- pertanyaan admin/help
- Bahasa Indonesia
- English
- typo/slang
- prompt injection
- data leakage prevention
- rate limit
- AI logs
- fallback provider
- AI error/down
- response tidak bocor data sensitif
- response tidak memberi akses admin palsu

> Catatan: `chatbot-runtime-qa.experimental.test.js` tetap experimental/backlog, bukan blocker QA utama.

## 17. STORE FEATURE TEST
Test:
- product list
- pricelist
- stock add
- stock list
- stock remove
- stock sold
- coupon apply
- invalid coupon
- expired coupon
- empty stock
- duplicate stock
- manual delivery
- digital delivery
- stock log

## 18. JOKI FEATURE TEST
Test:
- list antrian
- ambil order
- update progress
- selesai joki
- pindah penjoki
- catatan penjoki
- customer update
- legacy/enhanced dipisah
- jam antrian tampil
- format list sesuai standar

Format:
```
LIST ANTRIAN JOKI (PROSES)
ENHANCED / LEGACY
JAM: 07.00 - 12.00
1. NAMA - PAKET - STATUS - PENJOKI
```

## 19. MUSIC FEATURE TEST
Test:
- join voice
- play query
- play URL
- queue song
- skip
- pause
- resume
- stop
- leave
- invalid URL
- user tidak di voice
- bot missing permission
- reconnect behavior
- cleanup queue music

## 20. FUN COMMAND TEST
Test:
- semua fun command respond
- tidak crash
- cooldown jalan
- output aman
- tidak spam
- tidak bocor data

## 21. SETUP FEATURE TEST
Test:
- initial setup
- setup ulang
- missing role
- missing channel
- invalid ID
- permission missing
- partial setup recovery
- env verification
- setup tidak overwrite sembarangan

## 22. STRUCTURE COMMAND TEST
Test:
- server structure command
- category creation
- channel creation
- permission overwrites
- duplicate prevention
- rollback kalau gagal
- tidak merusak channel lama

## 23. NOTIFICATION & LOG TEST
Test log:
- order log
- payment log
- ticket log
- queue log
- admin log
- AI log
- moderation log
- error log
- delivery log
- security log

Cek:
- log channel benar
- fallback kalau channel hilang
- tidak ada token/env di log
- log cukup jelas untuk audit

## 24. ANTI-SPAM & MODERATION TEST
Test:
- mention spam
- message spam
- command spam
- repeated button click
- repeated modal submit
- cooldown
- blacklist
- whitelist
- safeReply
- no invalid ephemeral on message
- logModeration benar
- tidak false positive berlebihan

## 25. SECURITY ABUSE TEST
Test:
- user akses admin command
- staff akses owner command
- fake interaction payload
- malformed input
- long input
- markdown injection
- link injection
- role spoof attempt
- double submit
- double approve
- race condition
- token/env tidak bocor
- AI prompt injection
- data customer tidak bocor

## 26. DATA STORAGE TEST
Test:
- JSON read
- JSON write
- corrupted JSON recovery
- missing data file
- backup data
- restore data
- concurrent write prevention
- single instance lock
- data tidak ikut commit git
- logs tidak ikut commit git
- backup tidak ikut commit git

## 27. REPOSITORY TEST
Test repository:
- users
- orders
- order_items
- payments
- tickets
- queue
- products
- pricelists
- testimonials
- verification
- ai_logs
- admin_logs
- bot_logs
- settings
- migration init
- missing field handling

## 28. INTEGRATION TEST
Test koneksi:
- command → handler
- handler → service
- service → repository
- repository → JSON storage
- order → ticket
- order → invoice
- payment → order
- payment → queue
- payment → delivery
- queue → channel message
- AI → log
- dashboard → runtime jika ada

## 29. RUNTIME TEST
Test:
- bot start
- ready event
- command deploy
- command sync 100
- PM2 online
- no crash
- no unhandled rejection
- no SweepFilterReturn error
- reconnect Discord
- graceful shutdown
- restart PM2
- logs clean setelah startup

## 30. PERFORMANCE TEST
Test:
- banyak command bersamaan
- banyak order bersamaan
- banyak ticket bersamaan
- banyak queue update
- banyak AI request
- banyak music request
- memory stabil
- response time wajar
- tidak freeze

## 31. RACE CONDITION TEST
Test:
- double approve payment
- double close ticket
- double claim ticket
- double queue assign
- double stock delivery
- dua admin edit order bersamaan
- user submit modal dua kali
- dua staff klik tombol sama
- duplicate invoice action

## 32. EDGE CASE TEST
Test:
- nama user aneh
- username panjang
- input emoji
- input simbol
- input kosong
- input terlalu panjang
- channel dihapus
- role dihapus
- message lama di-click
- expired interaction
- bot restart saat order belum selesai

## 33. REGRESSION TEST
Setelah fix bug, test ulang:
- command registry
- permission
- order
- payment
- ticket
- queue
- AI
- store
- music
- setup
- security
- runtime

## 34. AUTOMATED QA GATE
Jalankan:
```bash
npm test
npm run qa:runtime
npm run qa:all
npm run qa:e2e
npm run audit
npm run verify:discord-env
```

Expected:
- semua pass
- audit 0 vulnerabilities
- runtime clean
- command tetap 100/100

## 35. MANUAL UAT DISCORD
Test langsung di Discord staging dengan:
- owner
- admin
- staff
- penjoki
- customer verified
- customer non-verified

Cek:
- flow terasa enak
- tombol tidak membingungkan
- panel tidak dobel
- response jelas
- admin mudah proses order
- customer tidak bingung

## 36. SOAK TEST
Setelah QA utama pass, nyalakan bot:

```bash
pm2 start hypebotx
```

Pantau 1–2 jam:
```bash
pm2 status
pm2 logs hypebotx --lines 100 --nostream
```

Expected:
- online stabil
- `err.log` bersih
- memory stabil
- tidak reconnect loop
- order/ticket/queue sinkron

## 37. PRODUCTION LIMITED TEST
Buka terbatas:
- owner
- admin
- 1 penjoki
- 1–3 customer trusted

Test flow real:
- order joki
- order digital
- payment
- queue
- ticket close
- testimoni

## 38. RELEASE REPORT
Buat laporan akhir:
- branch
- commit
- total command aktif
- total test pass/fail
- `qa:all` result
- `qa:e2e` result
- audit result
- UAT result
- gap fixed
- gap pending
- experimental backlog
- PM2 status
- final status

## 39. GO / NO-GO DECISION
GO kalau:
- main green
- audit 0 vulnerabilities
- command 100/100
- PM2 clean
- UAT pass
- queue/payment/ticket/order aman
- tidak ada P0/P1 bug

NO-GO kalau:
- payment rusak
- queue rusak
- ticket rusak
- data storage rusak
- command sensitif bocor
- bot crash
- ada vulnerability kritis

## 40. POST-RELEASE MONITORING
Setelah live:
- cek PM2 berkala
- cek `err.log`
- cek order pertama
- cek payment pertama
- cek queue pertama
- cek ticket pertama
- cek feedback admin/customer
- catat bug log
- jangan tambah fitur besar dulu sebelum stabil
