# HYPEBOTX Live UAT Checklist

Status release: **READY FOR LIVE UAT**  
Status production: **BELUM FINAL**

Dokumen ini fokus ke core bisnis: `order`, `ticket`, `payment`, `queue`, `customer service`.

## Scope Prioritas UAT
1. Permission Discord live
2. Ticket order flow customer
3. Claim/finish oleh staff
4. Payment proof
5. Transcript sebelum close
6. Restart bot (persistensi data)
7. Concurrency 5-10 user
8. Close ticket confirmation
9. Verify strict gate

Music tetap dites, tapi bukan blocker utama launch UAT internal.

## Akun Uji Minimum
1. Owner
2. Admin/Staff
3. Customer Verified
4. User Baru (Unverified)

## Environment UAT
1. Jalankan bot pada guild UAT internal.
2. Pastikan command sudah sinkron.
3. Pastikan channel log aktif (`bot-logs`, `ticket-logs`, `order-logs`, `moderation-logs`).

## Test Cases Prioritas

### 1) Permission Discord Live
Step:
1. Cek role hierarchy bot di atas role yang dikelola.
2. Jalankan verify, create ticket, claim, finish, close.
Expected:
1. Tidak ada `Missing Permissions`.
2. Bot bisa assign role, kirim embed, kelola thread/ticket.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

### 2) Ticket Order dari Customer
Step:
1. Customer verified buat ticket order dari panel/command.
2. Isi modal order.
3. Kirim chat + upload gambar.
Expected:
1. Ticket/channel terbentuk normal.
2. Order summary terkirim tanpa error embed.
3. Customer bisa chat dan kirim attachment.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

### 3) Claim/Finish oleh Staff
Step:
1. Staff claim ticket/order.
2. Staff finish order.
Expected:
1. Status sinkron `ticket/order/queue`.
2. `claimedBy/claimedAt` dan `completedBy/completedAt` tersimpan.
3. User biasa tidak bisa claim/finish.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

### 4) Payment Proof
Step:
1. Customer upload bukti pembayaran image di ticket order.
2. Staff update payment status.
Expected:
1. Payment tercatat.
2. Status order/ticket update sesuai flow.
3. Log payment masuk channel log.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

### 5) Transcript Sebelum Close
Step:
1. Isi ticket dengan chat + attachment.
2. Tutup ticket.
Expected:
1. Transcript dibuat dulu sebelum channel/thread ditutup.
2. Path transcript tercatat dan log close terkirim.
3. Transcript tidak kosong.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

### 6) Restart Bot (Persistensi)
Step:
1. Buat ticket + claim + update status.
2. Restart bot.
3. Lanjutkan proses ticket yang sama.
Expected:
1. Data ticket/order/queue tetap terbaca.
2. Tidak ada data reset/korup.
3. Bot reconnect normal.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

### 7) Concurrency 5-10 User
Step:
1. 5-10 user verify hampir bersamaan.
2. 5 user buat ticket bersamaan.
3. Staff claim ticket berdekatan waktu.
Expected:
1. Tidak ada duplicate ticket/order/queue.
2. Tidak ada crash.
3. Log tetap rapi.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

### 8) Close Ticket Confirmation
Step:
1. Klik close ticket.
2. Coba `Cancel`.
3. Coba `Confirm`.
Expected:
1. Ticket tidak langsung tertutup tanpa konfirmasi.
2. Cancel membatalkan close.
3. Confirm menutup ticket dan membuat transcript.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

### 9) Verify Strict Gate
Step:
1. User baru (unverified) coba akses fitur order/ticket.
2. Klik verify.
3. Coba ulang akses fitur.
Expected:
1. Sebelum verify: akses ditolak dengan pesan jelas.
2. Setelah verify: role `MEMBER` aktif, `UNVERIFIED` dilepas.
3. Akses fitur terbuka setelah verify.
Pass/Fail:
- [ ] PASS
- [ ] FAIL
Catatan:

## Definisi Blocker UAT
Rilis **tidak boleh** naik ke production publik jika ada salah satu:
1. Customer tidak bisa chat/upload di ticket.
2. Status queue/order/ticket tidak sinkron.
3. Payment proof tidak tercatat atau status salah.
4. Transcript gagal dibuat saat close.
5. Restart bot menyebabkan data hilang/invalid.
6. Verify gate gagal (unverified bisa bypass fitur inti).

## Exit Criteria ke Production
1. Semua prioritas 1-9 PASS.
2. Tidak ada blocker aktif.
3. Error log kritikal = 0 pada sesi UAT final.
