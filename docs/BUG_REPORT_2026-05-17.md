# HYPEBOTX Bug / Blocker Report - 2026-05-17

## BUG ID: QA-BLOCKER-001

Title: Live five-account Discord UAT not executed in local automated pass
Severity: High
Area: Bot / Dashboard / API / Security / Payment / Ticket
Environment: Local Development
Branch: feature/pro-monorepo-dashboard
Commit: 1fb750e
Tester: Codex

Steps to reproduce:
1. Require real Discord accounts for Owner, Admin, Penjoki, Member Verified, Guest/Unverified.
2. Require staging OAuth redirect and real Discord guild/channel/role state.
3. Attempt to certify production readiness using only local mock automation.

Expected result:
All role, OAuth, ticket permission, payment proof, dashboard/browser, backup/restore, and Discord-dashboard sync scenarios are validated live.

Actual result:
Local automation passed, but live UAT was not executed because this workspace does not provide five real Discord test accounts and staging domain/OAuth context.

Screenshot/log:
See `docs/QA_REPORT_2026-05-17.md`.

File terkait:
- `docs/QA_REPORT_2026-05-17.md`

Status: Blocked
Assigned to: Owner/QA operator with Discord staging access

## BUG ID: QA-MEDIUM-001

Title: Bot lint warning backlog remains
Severity: Medium
Area: Bot / QA Hygiene
Environment: Local Development
Branch: feature/pro-monorepo-dashboard
Commit: 1fb750e
Tester: Codex

Steps to reproduce:
1. Run `npm run lint`.

Expected result:
Lint exits with 0 errors and ideally 0 warnings.

Actual result:
Lint exits successfully with 0 errors, but reports 140 existing warnings, mostly unused variables in bot source/tests.

Screenshot/log:
Command output from `npm run lint`.

File terkait:
- Multiple files under `apps/bot/src` and `apps/bot/tests`

Status: Open
Assigned to: Engineering

## BUG ID: QA-MEDIUM-002

Title: Ticket category does not deny @everyone ViewChannel
Severity: Medium
Area: Discord / Ticket Permission
Environment: Real guild HYPERINDO
Branch: feature/pro-monorepo-dashboard
Commit: 1fb750e
Tester: Codex

Steps to reproduce:
1. Run `npm run qa:live:guild`.
2. Inspect `ticket category @everyone hidden`.

Expected result:
Ticket category baseline denies `@everyone` ViewChannel, or there is documented proof that every ticket/thread creation applies strict per-ticket overwrites.

Actual result:
The configured ticket category does not deny `@everyone` ViewChannel. However, 8/8 sampled existing ticket channels deny `@everyone` ViewChannel.

Screenshot/log:
`logs/qa/live-discord-guild-audit-*.json`

File terkait:
- `scripts/live-discord-guild-audit.js`

Fix:
1. Ran `npm run qa:fix:order-center-perms`.
2. Saved before/after snapshots in `logs/qa/order-center-permissions-*.json`.
3. Applied category baseline:
   - `@everyone` deny ViewChannel, SendMessages, CreatePublicThreads, CreatePrivateThreads, SendMessagesInThreads.
   - Owner/Admin allowed ticket staff actions.
   - HYPEBOTX bot allowed required channel/thread/manage permissions.
   - Penjoki/MEMBER not allowed at category by default.
4. Created temporary sample ticket under ORDER CENTER.
5. Verified sample hides `@everyone`, Penjoki, and MEMBER by default while Owner/Admin/bot retain access.
6. Deleted temporary sample ticket.
7. Reran `npm run qa:live:guild`; category `@everyone` hidden check passed.

Status: Closed
Assigned to: Server admin / Engineering
