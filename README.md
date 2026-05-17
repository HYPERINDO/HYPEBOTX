# 🚀 HYPEBOTX

HYPEBOTX sekarang disusun sebagai monorepo profesional:

```text
apps/bot                  Discord bot runtime
apps/dashboard-backend    Express API, Discord OAuth, session, role, audit
apps/dashboard-frontend   React dashboard UI
packages/shared           Shared roles, statuses, permissions, helpers
packages/config           Shared config placeholders
infra                     Docker, PM2, Nginx, Compose
docs                      Technical documentation
scripts                   Dev/test/audit helpers
```

Common commands:

```powershell
npm run dev:all
npm run test:all
npm run lint:all
npm run build:all
npm run check
```

Secrets tetap hanya di bot/backend environment atau server environment. Frontend hanya memakai konfigurasi publik `VITE_*`.

## Operations Notes

Latest production maintenance on 2026-05-17:

```txt
Order data restore: PASS
Discord channel renew: PASS
PM2 bot/backend/frontend restart: PASS
Live guild QA: PASS
Live HTTP QA: PASS
```

Operational reminders:

- Keep `.env`, `.env.local`, and `.env.local.before-*` files local only.
- Use `npm run pm2:restart` or `pm2 start infra/pm2/ecosystem.config.js --update-env` after env/channel ID changes.
- Use `npm run qa:live:guild` and `npm run qa:live:http` after Discord structure changes.
- Use `scripts/renew-discord-channels.js` only for controlled channel renewal after structure backup.
- Use `npm run guide:discord` for dry-run usage guide delivery, then `npm run guide:discord -- --apply` to send/update channel guides.

<p align="center">
  <strong>Discord Bot for HYPERINDO Local Hosting</strong><br/>
  Store • Joki • Order • Payment • Ticket Automation • Customer Support
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Local%20Release%20Ready-brightgreen" />
  <img src="https://img.shields.io/badge/Runtime-PM2-blue" />
  <img src="https://img.shields.io/badge/Storage-JSON-orange" />
  <img src="https://img.shields.io/badge/Node-%3E%3D20-339933" />
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2" />
</p>

---

## 📌 Project Status

```txt
LOCAL RELEASE READY
AUTOMATED VALIDATION PASS
RUNTIME CLEAN
JSON STORAGE ENABLED
PM2 SINGLE INSTANCE
GITHUB REPO READY
WAITING MANUAL LIVE DISCORD TEST
```

> HYPEBOTX saat ini ditargetkan untuk **local hosting / single instance**.  
> Jangan jalankan dalam mode cluster atau lebih dari satu process karena storage utama masih berbasis JSON.

---

## 💖 Support / Donation

Jika project ini membantu operasional store, joki, ticket, atau automation kamu, kamu bisa support lewat Sociabuzz:

<p align="center">
  <a href="https://sociabuzz.com/jxxzyshn69" target="_blank">
    <img src="https://img.shields.io/badge/Support%20via-SociaBuzz-ff4081?style=for-the-badge" />
  </a>
</p>

<p align="center">
  <a href="https://sociabuzz.com/jxxzyshn69">
    https://sociabuzz.com/jxxzyshn69
  </a>
</p>

---

## 📦 Repository

```txt
Repository: https://github.com/HYPERINDO/HYPEBOTX
Current branch: main
```

---

## ✨ Features

### Core Features

- ✅ Verify / member gate
- ✅ Ticket system
- ✅ Claim ticket
- ✅ Close ticket
- ✅ Ticket transcript
- ✅ Ticket log
- ✅ Order / customer management
- ✅ Stock add / list / remove
- ✅ Coupon apply
- ✅ FAQ command
- ✅ Price command
- ✅ Music / voice command
- ✅ Audit system
- ✅ Rate limit
- ✅ Anti-spam
- ✅ Discord environment verification
- ✅ JSON local storage
- ✅ PM2 local hosting
- ✅ Single instance lock

### Store / Joki / Order Focus

HYPEBOTX difokuskan untuk:

```txt
STORE
JOKI
ORDER
PAYMENT
TICKET AUTOMATION
CUSTOMER SUPPORT
```

---

## 🧰 Requirements

- Node.js `>=20`
- npm
- PM2
- Discord Bot Token
- Discord Application Client ID
- Discord Guild ID
- Discord role/channel IDs

Check version:

```bash
node -v
npm -v
pm2 -v
```

Recommended:

```txt
Node.js 20.x
```

Project includes:

```txt
.nvmrc
package.json engines.node >=20
```

---

## ⚙️ Installation

Clone repository:

```bash
git clone https://github.com/HYPERINDO/HYPEBOTX.git
cd HYPEBOTX
```

Install dependencies:

```bash
npm ci
```

Use `npm ci` for clean install. Use `npm install` only when intentionally changing dependencies.

---

## 🔐 Environment Setup

Copy env example:

```powershell
Copy-Item .env.example .env.local
```

Or manually create `.env.local` (or `.env` if needed).

> Runtime prefers `.env.local`; `.env` is only used when `.env.local` is missing.

### Required Basic Config

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
```

### Required Discord Role / Channel Config

```env
TICKET_CATEGORY_ID=
MEMBER_ROLE_ID=
VERIFIED_ROLE_ID=
VERIFY_ROLE_ID=
VERIFIED_ROLE_IDS=

OWNER_ROLE_ID=
STAFF_ROLE_ID=

TICKET_LOG_CHANNEL_ID=
TRANSCRIPT_CHANNEL_ID=
```

### AI Config

```env
OPENAI_API_KEY=
```

### Storage Config

```env
STORAGE_DRIVER=json
STORAGE_PROVIDER=json
DATA_DIR=./data
DATABASE_DIR=./data
PM2_INSTANCES=1
```

### Runtime Config

```env
NODE_ENV=development
DEBUG_MUSIC=false
```

### Optional Dashboard Config

```env
DASHBOARD_ENABLED=false
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=3001
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=
```

---

## 🛡️ Verify Role Notes

Use one verified role:

```env
VERIFIED_ROLE_ID=123456789012345678
VERIFY_ROLE_ID=
VERIFIED_ROLE_IDS=
```

Or use multiple verified roles:

```env
VERIFIED_ROLE_ID=
VERIFY_ROLE_ID=
VERIFIED_ROLE_IDS=123456789012345678,987654321098765432
```

`VERIFY_ROLE_ID` is optional if `VERIFIED_ROLE_ID` is already used as the main verified role.

---

## 🆔 How to Get Discord IDs

Enable Developer Mode:

```txt
Discord Settings
Advanced
Developer Mode ON
```

Copy Role ID:

```txt
Server Settings
Roles
Right click role
Copy Role ID
```

Copy Channel or Category ID:

```txt
Right click channel/category
Copy Channel ID
```

Required IDs:

```txt
TICKET_CATEGORY_ID
MEMBER_ROLE_ID
VERIFIED_ROLE_ID
STAFF_ROLE_ID
OWNER_ROLE_ID
TICKET_LOG_CHANNEL_ID
TRANSCRIPT_CHANNEL_ID
```

---

## 🔍 Verify Discord Environment

Run:

```bash
npm run verify:discord-env
```

Expected result:

```txt
TICKET_CATEGORY_ID: OK
MEMBER_ROLE_ID: OK
STAFF_ROLE_ID: OK
OWNER_ROLE_ID: OK
VERIFIED_ROLE_ID: OK
TICKET_LOG_CHANNEL_ID: OK
TRANSCRIPT_CHANNEL_ID: OK
```

If an ID is missing or mismatched:

```txt
1. Copy the correct Role ID / Channel ID from Discord
2. Update .env.local (or .env if you are using fallback mode)
3. Restart PM2 with --update-env
4. Run npm run verify:discord-env again
```

---

## ▶️ Running the Bot

Run directly:

```bash
npm start
```

Recommended local hosting with PM2:

```bash
pm2 start ecosystem.config.js
```

Restart with updated environment:

```bash
pm2 restart ecosystem.config.js --update-env
```

View logs:

```bash
pm2 logs hypebotx --lines 100 --nostream
```

Check process:

```bash
pm2 describe hypebotx
```

Expected PM2 status:

```txt
status: online
exec_mode: fork
instances: 1
```

---

## ⚠️ PM2 Rules

Because storage is JSON-based, HYPEBOTX must run as a single instance.

Allowed:

```txt
PM2 fork mode
instances = 1
```

Not allowed:

```txt
PM2 cluster mode
multiple bot processes
PM2 + nodemon at the same time
two terminals running the bot with the same data folder
```

---

## 💾 JSON Storage

HYPEBOTX currently uses JSON storage for local hosting.

Default:

```env
STORAGE_DRIVER=json
DATA_DIR=./data
DATABASE_DIR=./data
```

Rules:

```txt
- Run only one bot instance
- Do not use cluster mode
- Keep data/ external
- Do not commit data/
- Backup data before live operation
- Test restore before final go-live
```

Runtime data should stay outside Git.

---

## 🔒 Single Instance Lock

The project includes a single instance lock.

Purpose:

```txt
- Prevent duplicate bot instances
- Protect JSON storage from concurrent writes
- Help future .exe launcher avoid double-start
```

Do not commit runtime lock files:

```txt
bot.lock
*.lock
```

---

## 🗄️ Backup and Restore

Create backup:

```bash
npm run backup:data
```

Manual PowerShell backup:

```powershell
Compress-Archive -Path .\data\* -DestinationPath ".\backup-data-$(Get-Date -Format yyyy-MM-dd-HHmm).zip"
```

Manual Linux/macOS backup:

```bash
tar -czf backup-data-$(date +%F-%H%M).tar.gz ./data
```

Restore test:

```txt
1. Extract backup into data-test/
2. Run bot/test with DATA_DIR=./data-test
3. Confirm data can be read
4. Confirm bot starts normally
```

Before live usage:

```txt
Backup: REQUIRED
Restore test: RECOMMENDED
```

---

## 🧪 Testing and Validation

Run unit tests:

```bash
npm test
```

Expected:

```txt
64/64 PASS
```

Run audit:

```bash
npm run audit
```

Expected:

```txt
0 vulnerabilities
```

Run staging QA:

```bash
npm run qa:staging
```

Expected:

```txt
4/4 PASS
```

Run Discord env verification:

```bash
npm run verify:discord-env
```

Expected:

```txt
Configured env IDs synced with live guild
```

Run PM2 runtime check:

```bash
pm2 logs hypebotx --lines 100 --nostream
```

Expected:

```txt
No runtime errors
No command load failed
No interaction failed
No permission errors
```

---

## 🎮 Live Discord Test Checklist

Manual Discord testing is required before final go-live.

```txt
[ ] verify button
[ ] verified user can open ticket
[ ] non-verified user is rejected
[ ] staff/owner bypass works
[ ] open ticket
[ ] claim ticket
[ ] close ticket
[ ] confirm close
[ ] transcript generate
[ ] ticket log sent
[ ] price command
[ ] faq command
[ ] stock add
[ ] stock list
[ ] stock remove
[ ] coupon apply
[ ] add order
[ ] customer set
[ ] music join
[ ] music play
[ ] music stop
[ ] music leave
[ ] rate limit spam click
[ ] anti-spam behavior
```

After manual test:

```bash
pm2 logs hypebotx --lines 100 --nostream
```

Expected:

```txt
No new errors
No command load failed
No interaction failed
No permission error
```

---

## ✅ Go-Live Criteria

HYPEBOTX can be marked:

```txt
GO-LIVE APPROVED FOR LOCAL HOSTING
```

only if all checks pass:

```txt
[ ] npm test PASS
[ ] npm run audit PASS
[ ] npm run qa:staging PASS
[ ] npm run verify:discord-env PASS
[ ] PM2 online
[ ] PM2 fork mode
[ ] PM2 instances = 1
[ ] PM2 logs clean
[ ] .env role/channel IDs valid
[ ] JSON backup done
[ ] Manual live Discord test PASS
[ ] .env not committed
[ ] data/logs/backup not committed
```

Current final status before manual Discord test:

```txt
LOCAL RELEASE READY
AUTOMATED VALIDATION PASS
RUNTIME CLEAN
WAITING MANUAL LIVE DISCORD TEST
```

---

## 🔐 Git and Security Rules

Before push:

```bash
git status --short
git check-ignore -v .env
```

Do not push:

```txt
.env
.env.local
data/
logs/
backup/
node_modules/
bot.lock
*.lock
scratch_*.js
test-output*.txt
*.log
```

Safe to push:

```txt
src/
scripts/
tests/
tools/
assets/
docs/
.github/
package.json
package-lock.json
.env.example
.gitignore
.dockerignore
.nvmrc
ecosystem.config.js
Dockerfile
docker-compose.yml
docker-compose.staging.yml
README.md
```

If a token was exposed, rotate immediately:

```txt
DISCORD_TOKEN
OPENAI_API_KEY
```

Optional Git secret check:

```bash
git log -p --all -S "DISCORD_TOKEN"
git log -p --all -S "OPENAI_API_KEY"
git log -p --all -S "token"
```

---

## 🤖 Discord Developer Portal Checklist

Check bot application settings:

```txt
[ ] SERVER MEMBERS INTENT enabled if checking member/roles
[ ] MESSAGE CONTENT INTENT enabled if anti-spam/message reading is required
[ ] PRESENCE INTENT only if actually used
[ ] OAuth2 scope includes bot
[ ] OAuth2 scope includes applications.commands
[ ] Invite permission integer matches ticket/verify/music requirements
```

Required server permissions may include:

```txt
ViewChannel
SendMessages
ReadMessageHistory
EmbedLinks
AttachFiles
ManageChannels
ManageRoles
ModerateMembers
Connect
Speak
UseApplicationCommands
```

---

## 📊 Dashboard Plan

Dashboard is planned after local go-live is stable.

Recommended first version:

```txt
Local dashboard only
Host: 127.0.0.1
Port: 3001
Owner/admin only
```

Do not expose public dashboard yet.

MVP features:

```txt
- Bot status
- PM2 status
- Logs viewer
- Config checker SET/MISSING
- JSON backup button
- Ticket monitor
- Order monitor
- Stock monitor
```

Security rules:

```txt
- Do not show DISCORD_TOKEN
- Do not show OPENAI_API_KEY
- Do not dump .env
- Do not bind to 0.0.0.0 until login/security is ready
- Do not allow restart/stop without owner/admin auth
```

---

## 📦 EXE Plan

HYPEBOTX can be converted into a `.exe`, but the recommended first version is an `.exe launcher`.

Safe structure:

```txt
HYPEBOTX/
├─ hypebotx.exe
├─ .env
├─ data/
├─ logs/
├─ backup/
├─ package.json
├─ package-lock.json
├─ ecosystem.config.js
└─ README.md
```

Do not embed:

```txt
DISCORD_TOKEN
OPENAI_API_KEY
.env
data JSON
logs
backup
```

Requirements for `.exe` launcher:

```txt
- .env remains external
- data/ remains external
- logs/ remains external
- backup/ remains external
- no token inside binary
- prevent double instance
- use single instance lock
```

---

## 🧯 Troubleshooting

### Bot starts but ticket does not work

Check:

```env
TICKET_CATEGORY_ID=
MEMBER_ROLE_ID=
VERIFIED_ROLE_ID=
STAFF_ROLE_ID=
OWNER_ROLE_ID=
TICKET_LOG_CHANNEL_ID=
TRANSCRIPT_CHANNEL_ID=
```

Then run:

```bash
npm run verify:discord-env
pm2 restart ecosystem.config.js --update-env
```

---

### Env changes not applied

Run:

```bash
pm2 restart ecosystem.config.js --update-env
```

---

### Command load failed

Run:

```bash
npm test
pm2 logs hypebotx --lines 100 --nostream
```

If a file is listed, check syntax:

```bash
node --check path/to/file.js
```

---

### PM2 log contains old errors

Flush old logs:

```bash
pm2 flush hypebotx
pm2 restart ecosystem.config.js --update-env
pm2 logs hypebotx --lines 100 --nostream
```

---

### Git accidentally stages .env

Remove from staging:

```bash
git restore --staged .env
```

Confirm ignored:

```bash
git check-ignore -v .env
```

---

### JSON data backup

Run:

```bash
npm run backup:data
```

Confirm backup file exists and can be opened.

---

## 📝 Final Release Notes

Final known status:

```txt
GitHub push: DONE
Branch: main
Working tree after push: clean
Sensitive files: excluded
Runtime: clean
Audit: pass
Tests: pass
QA staging: pass
Discord env sync: pass
Manual Discord live test: pending
```

Final approval condition:

```txt
If manual Discord live test passes and PM2 logs remain clean:
GO-LIVE APPROVED FOR LOCAL HOSTING
```

---

## 💖 Support HYPEBOTX

If this project helps your store, ticket workflow, joki operation, or customer automation, you can support the development here:

<p align="center">
  <a href="https://sociabuzz.com/jxxzyshn69">
    <img src="https://img.shields.io/badge/Support%20HYPEBOTX-SociaBuzz-ff4081?style=for-the-badge" />
  </a>
</p>

<p align="center">
  <a href="https://sociabuzz.com/jxxzyshn69">
    https://sociabuzz.com/jxxzyshn69
  </a>
</p>

---

<p align="center">
  <strong>HYPEBOTX</strong><br/>
  Local hosting ready Discord bot for HYPERINDO operations.
</p>

---

## Dependency Upgrade Policy (Staging Safe)

Dependency update dilakukan bertahap dan tidak memblokir staging selama:

```txt
- Tidak ada security vulnerability aktif
- QA staging dan QA inti tetap PASS
- Runtime PM2 tetap clean
```

Urutan upgrade yang direkomendasikan:

```txt
Phase 1 (low risk): dotenv
Phase 2 (peer-sensitive): opusscript (menunggu kompatibilitas prism-media)
Phase 3 (service scoped): express + helmet (monitoring service)
Phase 4 (integration scoped): redis + rate-limiter-flexible
Phase 5 (AI scoped): openai SDK major upgrade
```

Checklist tiap fase:

```txt
1. Update 1-2 dependency saja
2. npm install
3. npm test
4. npm run qa:e2e
5. npm run qa:all
6. Validasi PM2 logs clean
```

Jika satu fase gagal, rollback fase tersebut dan lanjut staging dengan versi stabil terakhir.
