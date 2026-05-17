# HYPEBOTX Web Dashboard - Discord Login

Dashboard web baru berjalan sebagai server Express terpisah dari flow Discord command, tetapi tetap memakai data dan service HYPEBOTX yang sama.

## Fitur

- Login / logout memakai akun Discord.
- Role dashboard diambil dari member role server Discord:
  - Owner: akses semua tab.
  - Admin/staff: akses operasional admin, kecuali owner tools.
  - Penjoki: akses overview, available queue, dan my job.
- Satu dashboard terpadu untuk owner, admin, dan penjoki.
- Tab tersedia:
  - Overview
  - Order
  - Payment
  - Joki
  - My Job
  - Ticket (owner/admin)
  - Stock
  - Customer
  - Coupon
  - Report / health
  - Owner tools
- Session cookie `HttpOnly`.
- Data sensitif seperti stock unit value/license/account detail tidak ditampilkan.

## Env

```env
# Frontend URL for redirects and client app
FRONTEND_URL=http://localhost:5173
# Backend API base URL for the dashboard service
BACKEND_URL=http://localhost:4000
# Alternative aliases accepted by the backend
DASHBOARD_PUBLIC_URL=http://localhost:5173
DASHBOARD_BASE_URL=http://localhost:4000

# Discord OAuth
DASHBOARD_DISCORD_CLIENT_ID=YOUR_DISCORD_APP_CLIENT_ID
DASHBOARD_DISCORD_CLIENT_SECRET=YOUR_DISCORD_APP_CLIENT_SECRET
DASHBOARD_DISCORD_REDIRECT_URI=http://localhost:4000/api/auth/discord/callback
# Optional legacy aliases
DISCORD_CLIENT_ID=YOUR_DISCORD_APP_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_DISCORD_APP_CLIENT_SECRET
DISCORD_REDIRECT_URI=http://localhost:4000/api/auth/discord/callback

# Owner + staff mapping
OWNER_DISCORD_IDS=YOUR_OWNER_DISCORD_ID
ADMIN_ROLE_ID=YOUR_ADMIN_ROLE_ID
PENJOKI_ROLE_ID=YOUR_PENJOKI_ROLE_ID

# Session and security
DASHBOARD_SESSION_SECRET=CHANGE_ME_LONG_RANDOM
DASHBOARD_COOKIE_SECURE=false
DASHBOARD_SESSION_TTL_MS=28800000
```

Untuk VPS dengan HTTPS:

```env
FRONTEND_URL=https://dashboard.domainmu.com
BACKEND_URL=https://dashboard.domainmu.com
DASHBOARD_PUBLIC_URL=https://dashboard.domainmu.com
DASHBOARD_BASE_URL=https://dashboard.domainmu.com
DASHBOARD_DISCORD_REDIRECT_URI=https://dashboard.domainmu.com/api/auth/discord/callback
DASHBOARD_COOKIE_SECURE=true
```

## Discord Developer Portal

Untuk `apps/dashboard-backend`, gunakan redirect URI berikut di OAuth2 settings:

```txt
http://localhost:4000/api/auth/discord/callback
```

Jika kamu juga menjalankan legacy dashboard dari `apps/bot`, daftarkan alternatif ini:

```txt
http://127.0.0.1:3001/auth/discord/callback
http://127.0.0.1:3001/api/auth/discord/callback
```

Untuk VPS:

```txt
https://dashboard.domainmu.com/api/auth/discord/callback
```

## Menyalakan Dashboard

Opsi 1: otomatis saat bot ready:

```env
DASHBOARD_ENABLED=true
```

Opsi 2: manual dari Discord:

```txt
/dashboard start
/dashboard status
/dashboard stop
```

## Catatan Keamanan

- Jangan commit `DASHBOARD_DISCORD_CLIENT_SECRET`.
- Bind local default tetap `127.0.0.1`.
- Untuk public VPS, pasang Nginx + SSL dan gunakan `DASHBOARD_COOKIE_SECURE=true`.
- Aksi berbahaya seperti restore backup, maintenance, dan PM2 restart tetap harus lewat Discord panel dengan reason + confirm gate.
