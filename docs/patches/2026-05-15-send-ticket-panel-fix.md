Send-ticket-panel: defer reply to avoid Unknown interaction

What I changed

- Deferred the interaction before calling the slow `ticketService.sendTicketPanel(...)` call.
- Use `editReply(...)` if the interaction was deferred, otherwise fall back to `reply(...)`.

Files modified

- src/commands/setup/sendTicketPanel.js

Why

Discord interactions must be acknowledged within ~3 seconds. Long-running service calls can cause `DiscordAPIError[10062]: Unknown interaction` if the bot replies after that window. Deferring the interaction prevents this.

Verification

- Ran the test suite locally: `npm test` — all tests passed (64/64).

Next steps (to create PR locally)

1. Create a branch:

```bash
git checkout -b fix/send-ticket-panel-defer-reply
```

2. Commit the change:

```bash
git add src/commands/setup/sendTicketPanel.js docs/patches/2026-05-15-send-ticket-panel-fix.md
git commit -m "fix: defer reply in send-ticket-panel to avoid Unknown interaction"
```

3. Push and open PR:

```bash
git push -u origin fix/send-ticket-panel-defer-reply
# then open a PR on GitHub or use hub/gh cli
gh pr create --fill
```

If you want, I can create the branch and open the PR for you (I will need git remote access).