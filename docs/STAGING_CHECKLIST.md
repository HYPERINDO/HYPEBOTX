**Staging Deployment & Verification Checklist**

Prerequisites
- Staging Discord server with test channels and test accounts
- A staging bot token (BOT_TOKEN) and env vars mirrored from production but safe
- PM2 installed on staging host and process named `hypebotx` in `ecosystem.config.js`
- Database path or service (sqlite/redis) accessible and seeded appropriately

Environment variables (common)
- BOT_TOKEN
- PAYMENT_REVIEW_CHANNEL_ID
- PAYMENT_LOG_CHANNEL_ID
- DATABASE_* or FILE paths
- NODE_ENV=staging

Pre-deploy
- Ensure backup of `data/` and database files
- Ensure test accounts created: customerTest, staffTest
- Ensure roles: staff, admin, joki are configured

Deploy (automated)
1. On staging host, from repo root:
   - `powershell -File scripts/deploy_staging.ps1 -Branch main -RunSeeds:$false -RunTests:$true`
2. Inspect `pm2 status` and `pm2 logs hypebotx --lines 200`

Manual smoke tests (Discord staging)
- Slash commands: `/help`, `/price`, `/open-order`, verify commands appear and respond
- AI/chatbot: mention bot and ask small-talk / ask order status with test Order ID
- Create ticket: open ticket via panel -> ensure ticket channel created
- Create order: fill order details in ticket; check order summary/invoice posted
- Payment proof: upload image in ticket -> ensure payment submitted and forwarded to review channel
- Approve payment (via staffTest): press approve button -> ensure:
  - payment status updated to `paid`
  - queue entry created for `joki` and `gta` form types
  - auto-delivery attempted (for digital SKU) and DM sent to customerTest
  - approve button disabled or second-approve blocked
- Quick Action Mark Done: run quick action -> ensure queue-list published and testimonial modal shown
- Edge cases:
  - double-approve blocked
  - DM failure reverts stock reservation
  - coupon usage rules enforced

Monitoring & logs
- PM2: `pm2 status` and `pm2 monit`
- Persistent logs: `logs/realtime-server-audit.json`, `pm2 logs hypebotx`
- Watch for repeated exceptions like `SweepFilterReturn` from discord.js

Rollback
- If critical errors found, roll back to previous tag/commit:
  - `git checkout <previous-commit>` -> `git reset --hard` -> `pm2 restart ecosystem.config.js`
  - Restore DB backup if needed

Sign-off criteria (ready for production)
- All automated QA (`npm run qa:all`) pass on staging host
- Manual smoke tests pass for core flows (order/ticket/payment/queue/delivery)
- No repeated runtime exceptions in logs for 30 minutes under smoke load
- Monitoring and alerts configured

How I can help
- I can review logs and failing tests you paste here and prepare fixes, CI patches, or PRs.
- If you provide CI/staging host access or run output, I can iterate on code until staging green.
