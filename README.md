# 🚀 HYPEBOTX

<p align="center">
  <strong>Discord Bot for HYPERINDO Operations</strong><br/>
  Store • Joki • Order • Payment • Ticket Automation • Queue • AI Support • Customer Service
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Staging--Ready-brightgreen" />
  <img src="https://img.shields.io/badge/Commands-100%2F100-blue" />
  <img src="https://img.shields.io/badge/Tests-154%20PASS-success" />
  <img src="https://img.shields.io/badge/Fail-0-brightgreen" />
  <img src="https://img.shields.io/badge/Runtime-PM2-blue" />
  <img src="https://img.shields.io/badge/Storage-JSON-orange" />
  <img src="https://img.shields.io/badge/Node-%3E%3D20-339933" />
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2" />
</p>

---

## 📌 Current Project Status

```txt
STAGING-READY / PRE-PRODUCTION READY
100/100 SLASH COMMANDS VALID
100 UNIQUE COMMAND NAMES
100 GUILD COMMANDS SYNCED AT RUNTIME
154 AUTOMATED TESTS PASS
0 TEST FAILURES
AI FEATURE ENABLED
JSON STORAGE ENABLED
PM2 SINGLE INSTANCE
RUNTIME CLEAN AFTER LATEST RESTART
WAITING FINAL SOAK CHECK + MANUAL UAT BEFORE FULL PRODUCTION
```

HYPEBOTX saat ini ditargetkan untuk **local hosting / single instance**.
Jangan jalankan dalam mode cluster atau lebih dari satu process karena storage utama masih berbasis JSON.

---

## ✅ Latest Update Summary

### Slash Command Status

```txt
Command files valid: 100/100
Unique command names: 100
Runtime guild command sync: 100 commands
Status: PASS
```

### Active Command Categories

| Category | Total |
|---|---:|
| admin | 35 |
| customer | 10 |
| fun | 10 |
| joki | 5 |
| music | 10 |
| setup | 10 |
| store | 8 |
| structure | 7 |
| ticket | 4 |
| root/admin-priority | 1 |
| **Total** | **100** |

### Automated Test Result

#### `npm run qa:all`

| Test Group | Total | Status |
|---|---:|---|
| core | 83 | PASS |
| chatbot-heavy | 2 | PASS |
| heavy | 15 | PASS |
| business | 12 | PASS |
| features | 26 | PASS |
| integration | 2 | PASS |
| security | 6 | PASS |
| runtime | 1 | PASS |
| **Total qa:all** | **147** | **PASS** |

#### `npm run qa:e2e`

| Test Group | Total | Status |
|---|---:|---|
| integration | 2 | PASS |
| runtime | 1 | PASS |
| staging | 4 | PASS |
| **Total qa:e2e** | **7** | **PASS** |

### Total Test Result

```txt
qa:all: 147 PASS
qa:e2e: 7 PASS
TOTAL: 154 PASS
FAIL: 0
STATUS: PASS FULL
```

---

## 🧩 Critical Fixes Completed

```txt
✅ Fixed AI /ask variable order bug that could trigger ReferenceError
✅ Added /ai alias command without overwriting /ask
✅ Deploy script default is now full command mode
✅ legacy_minimal deploy option remains available
✅ analyticsService wired into service container
✅ Anti-spam hardening completed
✅ mentions count validation fixed
✅ Invalid ephemeral reply on message flow fixed
✅ logModeration signature fixed
✅ Whitelist middleware now uses MessageFlags.Ephemeral
✅ Added aiLogs storage/repository
✅ Added compact interaction logging for /ask
✅ Fixed Discord sweeper config crash: SweepFilterReturn
✅ PM2 restart completed
✅ Runtime status online
✅ No new startup error after latest patch/restart
```

---

## ✨ Main Features

### Core System

- ✅ 100 active slash commands
- ✅ Command sync on runtime
- ✅ Verify / member gate
- ✅ Permission guard
- ✅ Role-based access control
- ✅ Ticket system
- ✅ Claim ticket
- ✅ Close ticket
- ✅ Ticket transcript
- ✅ Ticket log
- ✅ Runtime logging
- ✅ Audit system
- ✅ Rate limit
- ✅ Anti-spam
- ✅ Guild whitelist middleware
- ✅ JSON local storage
- ✅ PM2 local hosting
- ✅ Single instance lock

### Store / Order / Customer

- ✅ Order flow
- ✅ Product/service selection
- ✅ Customer management
- ✅ Price command
- ✅ FAQ command
- ✅ Stock add/list/remove
- ✅ Coupon apply
- ✅ Payment flow support
- ✅ Invoice/order summary support
- ✅ Admin processing flow

### Joki Operations

- ✅ Joki service flow
- ✅ Queue/list antrian support
- ✅ Queue status tracking plan
- ✅ Admin/penjoki handling flow
- ✅ Legacy / Enhanced service separation ready

### AI Features

- ✅ `/ask` command
- ✅ `/ai` alias command
- ✅ AI interaction logging
- ✅ AI error hardening
- ✅ OPENAI_API_KEY environment support

### Music / Voice

- ✅ Music command category
- ✅ Voice command support
- ✅ Join/play/stop/leave flow support

---

## 🧠 Full Analysis Scope Completed

Audit scope menggunakan 21 analisa utama:

```txt
1. Feature Inventory Analysis
2. Category Flow Analysis
3. Requirement Analysis
4. Business Flow Analysis
5. User Flow Analysis
6. Admin Flow Analysis
7. UI/UX Command Analysis
8. Use Case Analysis
9. State Machine Analysis
10. Queue Management Analysis
11. AI Feature Analysis
12. Data Flow Analysis
13. Database Schema Analysis
14. Permission Matrix Analysis
15. Security & Abuse Risk Analysis
16. Validation & Error Flow Analysis
17. Dependency Analysis
18. Integration Analysis
19. Testing Scenario / QA Analysis
20. Deployment & Monitoring Analysis
21. Maintenance & Improvement Analysis
```

Audit command inventory lengkap tersedia di:

```txt
docs/AUDIT_HYPEBOTX_2026-05-16.md
```

---

## 🧪 Testing and Validation

### Run Full QA

```bash
npm run qa:all
```

Expected:

```txt
147 PASS
0 FAIL
```

### Run E2E QA

```bash
npm run qa:e2e
```

Expected:

```txt
7 PASS
0 FAIL
```

### Run Unit Tests

```bash
npm test
```

### Run Audit

```bash
npm run audit
```

Expected:

```txt
0 vulnerabilities
```

### Verify Discord Environment

```bash
npm run verify:discord-env
```

Expected:

```txt
Configured env IDs synced with live guild
```

### Check PM2 Runtime Logs

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

## 🎮 Manual UAT Checklist Before Production

Manual Discord testing tetap wajib sebelum production full public.

### Order / Store Flow

```txt
[ ] User opens order panel
[ ] User selects service category
[ ] User fills required form
[ ] User selects pricelist/package
[ ] User reviews summary
[ ] User confirms order
[ ] Ticket/thread is created after confirm
[ ] Invoice/order summary appears correctly
[ ] Admin can process order
[ ] Order can be marked done
[ ] Ticket can be closed
```

### Joki Queue Flow

```txt
[ ] Joki order created
[ ] Payment/admin approval completed
[ ] Order enters queue/list antrian
[ ] Queue number is correct
[ ] Penjoki can be assigned
[ ] Status changes to IN_PROGRESS
[ ] Status changes to DONE
[ ] Cancel/refund does not break queue
```

### AI Flow

```txt
[ ] /ask works
[ ] /ai alias works
[ ] AI response is safe and clean
[ ] AI error fallback works
[ ] AI logs are created properly
[ ] Sensitive data is not exposed publicly
```

### Ticket / Verify / Support

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
```

### Store Utility

```txt
[ ] price command
[ ] faq command
[ ] stock add
[ ] stock list
[ ] stock remove
[ ] coupon apply
```

### Music / Voice

```txt
[ ] music join
[ ] music play
[ ] music stop
[ ] music leave
```

### Security / Abuse

```txt
[ ] admin command blocked for normal user
[ ] setup command blocked for normal user
[ ] payment approve blocked for normal user
[ ] rate limit spam click
[ ] anti-spam behavior
[ ] no sensitive response appears publicly
```

---

## 🚦 Production Readiness Status

Current status:

```txt
STAGING-READY / PRE-PRODUCTION READY
```

Recommended final steps:

```txt
1. Soak check 1-2 hours
2. Monitor PM2 status
3. Monitor out.log and err.log
4. Confirm SweepFilterReturn does not appear again
5. Run manual UAT in Discord staging/server
6. Backup JSON data
7. Commit final README update
8. Tag release
9. Start limited production test with trusted users
```

Production can be approved when:

```txt
[ ] qa:all PASS
[ ] qa:e2e PASS
[ ] PM2 online
[ ] PM2 fork mode
[ ] PM2 instances = 1
[ ] PM2 logs clean after soak check
[ ] Manual UAT PASS
[ ] JSON backup done
[ ] .env not committed
[ ] data/logs/backup not committed
```

Final label after all checks:

```txt
PRODUCTION READY FOR LOCAL HOSTING
```

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

## 🧰 Requirements

- Node.js `>=20`
- npm
- PM2
- Discord Bot Token
- Discord Application Client ID
- Discord Guild ID
- Discord role/channel IDs
- OpenAI API key for AI feature

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
Copy-Item .env.example .env
```

Or manually create `.env`.

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
.env.priority-features.example
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

MVP features:

```txt
- Bot status
- PM2 status
- Logs viewer
- Config checker SET/MISSING
- JSON backup button
- Ticket monitor
- Order monitor
- Queue monitor
- Stock monitor
- AI usage monitor
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

### Env changes not applied

```bash
pm2 restart ecosystem.config.js --update-env
```

### Command load failed

```bash
npm test
pm2 logs hypebotx --lines 100 --nostream
```

If a file is listed, check syntax:

```bash
node --check path/to/file.js
```

### PM2 log contains old errors

```bash
pm2 flush hypebotx
pm2 restart ecosystem.config.js --update-env
pm2 logs hypebotx --lines 100 --nostream
```

### Git accidentally stages .env

```bash
git restore --staged .env
git check-ignore -v .env
```

### JSON data backup

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
Slash commands: 100 active
Command sync: 100 guild commands
Automated tests: 154 PASS
Fail: 0
Runtime: PM2 online
Audit: generated
Security test: pass
E2E staging: pass
Manual Discord UAT: recommended before full production
Soak check: recommended before full production
```

Final approval condition:

```txt
If manual Discord UAT passes and PM2 logs remain clean after soak check:
PRODUCTION READY FOR LOCAL HOSTING
```

---

<p align="center">
  <strong>HYPEBOTX</strong><br/>
  Staging-ready Discord bot for HYPERINDO local hosting operations.
</p>
