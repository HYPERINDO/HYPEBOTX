Interaction Handling Audit — 2026-05-15

Summary

Performed a focused audit of interaction handlers to reduce `DiscordAPIError[10062]: Unknown interaction` by ensuring slow flows acknowledge interactions within the 3s window.

What I changed

- `src/commands/setup/sendTicketPanel.js`
  - Deferred reply before calling `ticketService.sendTicketPanel(...)` and used `editReply` afterwards.

- `src/handlers/selectMenuHandler.js`
  - Deferred before calling `orderService.setOrderStatus(...)` and before `storeOpsService.getPriceList(...)`.
  - Use `editReply` when interaction was deferred.

- `src/handlers/modalHandler.js`
  - Deferred in `testimoniModal` flow before DB/external calls and used `editReply` after submission.

Verification

- Ran full unit test suite: `npm test` — all tests passed (64/64).
- Added `src/tests/interaction-reply.test.js` to cover deferred/followUp interaction handling and safe reply fallback behavior.

Notes & Next Steps

- Pattern observed: some services reply directly (`interaction.reply(...)`) while other handlers perform awaits then reply. Introducing defers in handlers is safe when the handler is fully responsible for the reply. For flows where services reply themselves (e.g., `backlogService.handleQuickActionButton`), do NOT defer at the caller; instead modify the service if needed.

- Recommended phased approach for full audit:
  1. Automated scan: find handler/service files that `await` before `interaction.reply` in same scope.
  2. Produce a review list of candidates (file diffs) so you can approve changes.
  3. Apply changes conservatively: add `deferReply` + `editReply` where appropriate, or update services to use `editReply` when interaction is deferred.
  4. Add unit tests simulating delayed operations to prevent regressions.
  5. Open PR with changes and summary.

If you want, I can proceed to run the automated scan and generate a list of candidate files to change, then either (A) apply the changes automatically, or (B) present a patch-by-patch review for your approval. Which do you prefer?