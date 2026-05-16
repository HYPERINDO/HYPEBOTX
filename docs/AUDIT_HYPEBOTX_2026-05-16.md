# AUDIT HYPEBOTX 2026-05-16

- Total command file: **100**
- Unique slash command name: **100**
- Categories: admin, admin-priority.js, customer, fun, joki, music, setup, store, structure, ticket

## Command Inventory (100)

| Name | Category | Handler File | Role/Guard Hint | Dependencies (Service) | Dependencies (Repository) | Status |
|---|---|---|---|---|---|---|
| 8ball | fun | src/commands/fun/eightBall.js | - | funService | - | active |
| addorder | admin | src/commands/admin/addOrder.js | owner_or_staff | storeOpsService | - | active |
| addqueue | admin | src/commands/admin/addQueue.js | joki_crew | storeOpsService | - | active |
| admin-priority | admin-priority.js | src/commands/admin-priority.js | discord_default_perm | antiSpamService, crashDetectionService, enhancedBackupService, guildWhitelistService, jsonRecoveryService, migrationService | - | active |
| afk | fun | src/commands/fun/afk.js | - | moderationService | - | active |
| ai | customer | src/commands/customer/ai.js | - | - | - | active |
| apply-coupon | customer | src/commands/customer/applyCoupon.js | - | backlogService | ticketRepository | active |
| apply-permissions | structure | src/commands/structure/applyPermissions.js | discord_default_perm | structureService | - | active |
| ask | customer | src/commands/customer/ask.js | - | aiService, aiToolScannerService, chatbotService | - | active |
| audit | admin | src/commands/admin/audit.js | owner_or_staff | auditService | - | active |
| audit-server | structure | src/commands/structure/auditServer.js | discord_default_perm | auditService | - | active |
| backup-structure | structure | src/commands/structure/backupStructure.js | discord_default_perm | backupService | - | active |
| blacklist | admin | src/commands/admin/blacklist.js | owner_or_staff | storeOpsService | - | active |
| claim-ticket | ticket | src/commands/ticket/claimTicket.js | staff_command_perm, discord_default_perm | ticketService | - | active |
| close-order | store | src/commands/store/closeOrder.js | staff_command_perm, discord_default_perm | orderService | - | active |
| close-ticket | ticket | src/commands/ticket/closeTicket.js | staff_command_perm, discord_default_perm | ticketService | - | active |
| coinflip | fun | src/commands/fun/coinflip.js | - | funService | - | active |
| coupon | admin | src/commands/admin/coupon.js | owner_or_staff | - | opsRepository | active |
| customer-profile | admin | src/commands/admin/customerProfile.js | staff_command_perm, discord_default_perm | - | orderRepository, userRepository | active |
| customer-set | admin | src/commands/admin/customerSet.js | staff_command_perm, discord_default_perm | storeOpsService | userRepository | active |
| dashboard | admin | src/commands/admin/dashboard.js | discord_default_perm | backlogService | - | active |
| delivery-status | admin | src/commands/admin/deliveryStatus.js | staff_command_perm, discord_default_perm | deliveryService | - | active |
| dispute | admin | src/commands/admin/dispute.js | owner_or_staff, staff_command_perm, discord_default_perm | refundDisputeService | - | active |
| export | admin | src/commands/admin/export.js | owner_or_staff | - | - | active |
| faq | customer | src/commands/customer/faq.js | owner_or_staff | storeOpsService | - | active |
| format | setup | src/commands/setup/format.js | owner_or_staff | - | - | active |
| giveaway | fun | src/commands/fun/giveaway.js | discord_default_perm | funService | - | active |
| guide | admin | src/commands/admin/guide.js | owner_or_staff | - | - | active |
| health | admin | src/commands/admin/health.js | owner_or_staff | loggingService | orderRepository, paymentRepository, stockRepository, userRepository | active |
| help | customer | src/commands/customer/help.js | - | - | - | active |
| invoice | admin | src/commands/admin/invoice.js | owner_or_staff, staff_command_perm, discord_default_perm | - | - | active |
| joki-clear | joki | src/commands/joki/jokiClear.js | joki_crew | jokiService | jokiRepository | active |
| joki-done | joki | src/commands/joki/jokiDone.js | joki_crew | jokiService | ticketRepository | active |
| joki-history | admin | src/commands/admin/jokiHistory.js | owner_or_staff, staff_command_perm, discord_default_perm | - | - | active |
| joki-komisi | admin | src/commands/admin/jokiKomisi.js | discord_default_perm | backlogService | - | active |
| joki-queue | joki | src/commands/joki/jokiQueue.js | - | jokiService | ticketRepository | active |
| joki-shift | admin | src/commands/admin/jokiShift.js | discord_default_perm | backlogService | - | active |
| joki-status | joki | src/commands/joki/jokiStatus.js | - | jokiService | - | active |
| joki-sync-all | admin | src/commands/admin/jokiSyncAll.js | joki_crew | - | - | active |
| joki-tomorrow | joki | src/commands/joki/jokiTomorrow.js | - | jokiService | - | active |
| leaderboard | fun | src/commands/fun/leaderboard.js | - | funService | - | active |
| leave | music | src/commands/music/leave.js | - | musicService | - | active |
| loop | music | src/commands/music/loop.js | - | musicService | - | active |
| maintenance | admin | src/commands/admin/maintenance.js | discord_default_perm | loggingService, storeOpsService | simpleStoreRepository | active |
| meme | fun | src/commands/fun/meme.js | - | funService | - | active |
| mutasi | admin | src/commands/admin/mutasi.js | discord_default_perm | backlogService | - | active |
| note | admin | src/commands/admin/note.js | owner_or_staff | storeOpsService | - | active |
| nowplaying | music | src/commands/music/nowPlaying.js | - | musicService | - | active |
| open-order | store | src/commands/store/openOrder.js | verified_member | orderService | - | active |
| order | customer | src/commands/customer/order.js | verified_member | storeOpsService | - | active |
| order-summary | admin | src/commands/admin/orderSummary.js | owner_or_staff, staff_command_perm, discord_default_perm | - | - | active |
| orderlist | admin | src/commands/admin/orderList.js | owner_or_staff | storeOpsService | - | active |
| pause | music | src/commands/music/pause.js | - | musicService | - | active |
| paymentcheck | admin | src/commands/admin/paymentCheck.js | owner_or_staff | storeOpsService | - | active |
| ping | customer | src/commands/customer/ping.js | - | - | - | active |
| play | music | src/commands/music/play.js | - | musicService | - | active |
| price | customer | src/commands/customer/price.js | - | storeOpsService | - | active |
| queue | music | src/commands/music/queue.js | - | musicService | - | active |
| quiz | fun | src/commands/fun/quiz.js | - | funService | - | active |
| quote | fun | src/commands/fun/quote.js | - | funService | - | active |
| rapihin | structure | src/commands/structure/rapihin.js | discord_default_perm | structureService | - | active |
| refund | admin | src/commands/admin/refund.js | owner_or_staff, staff_command_perm, discord_default_perm | refundDisputeService | - | active |
| rename-channels | structure | src/commands/structure/renameChannels.js | discord_default_perm | structureService | - | active |
| reopen-ticket | ticket | src/commands/ticket/reopenTicket.js | staff_command_perm, discord_default_perm | ticketService | - | active |
| restore-structure | structure | src/commands/structure/restoreStructure.js | discord_default_perm | backupService | - | active |
| resume | music | src/commands/music/resume.js | - | musicService | - | active |
| roll | fun | src/commands/fun/roll.js | - | funService | - | active |
| salesreport | admin | src/commands/admin/salesReport.js | owner_or_staff | storeOpsService | - | active |
| send-payment-panel | setup | src/commands/setup/sendPaymentPanel.js | staff_command_perm, discord_default_perm | paymentService | - | active |
| send-promo-panel | setup | src/commands/setup/sendPromoPanel.js | staff_command_perm, discord_default_perm | paymentService | - | active |
| send-role-panel | setup | src/commands/setup/sendRolePanel.js | discord_default_perm | verifyService | - | active |
| send-ticket-panel | setup | src/commands/setup/sendTicketPanel.js | staff_command_perm, discord_default_perm | ticketService | - | active |
| send-verify-panel | setup | src/commands/setup/sendVerifyPanel.js | discord_default_perm | verifyService | - | active |
| set-order-heist | admin | src/commands/admin/setOrderHeist.js | owner_or_staff | - | - | active |
| set-order-status | ticket | src/commands/ticket/setOrderStatus.js | staff_command_perm, discord_default_perm | orderService | - | active |
| setpayment | admin | src/commands/admin/setPayment.js | owner_or_staff | storeOpsService | - | active |
| setprice | admin | src/commands/admin/setPrice.js | owner_or_staff | storeOpsService | - | active |
| setrole | admin | src/commands/admin/setRole.js | owner_or_staff | storeOpsService | - | active |
| setup | setup | src/commands/setup/setup.js | discord_default_perm | paymentService, roleService, structureService, ticketService, verifyService | - | active |
| setup-basic | setup | src/commands/setup/setupBasic.js | discord_default_perm | structureService | - | active |
| setup-gamestore | setup | src/commands/setup/setupGamestore.js | discord_default_perm | paymentService, structureService, ticketService, verifyService | - | active |
| setup-roles | setup | src/commands/setup/setupRoles.js | discord_default_perm | roleService | - | active |
| setup-terms | admin | src/commands/admin/setupTerms.js | discord_default_perm | backlogService | - | active |
| skip | music | src/commands/music/skip.js | - | musicService | - | active |
| sort-channels | structure | src/commands/structure/sortChannels.js | discord_default_perm | structureService | - | active |
| stafflog | admin | src/commands/admin/staffLog.js | owner_or_staff | - | simpleStoreRepository | active |
| status | customer | src/commands/customer/status.js | verified_member | storeOpsService | - | active |
| stock-add | store | src/commands/store/stockAdd.js | staff_command_perm, discord_default_perm | - | - | active |
| stock-edit | store | src/commands/store/stockEdit.js | staff_command_perm, discord_default_perm | - | - | active |
| stock-list | store | src/commands/store/stockList.js | staff_command_perm, discord_default_perm | - | - | active |
| stock-remove | store | src/commands/store/stockRemove.js | staff_command_perm, discord_default_perm | - | - | active |
| stock-update | store | src/commands/store/stockUpdate.js | staff_command_perm, discord_default_perm | - | - | active |
| stop | music | src/commands/music/stop.js | - | musicService | - | active |
| testwebhook | admin | src/commands/admin/testWebhook.js | owner_or_staff | - | - | active |
| ticket | customer | src/commands/customer/ticket.js | verified_member | ticketService | - | active |
| trivia | fun | src/commands/fun/trivia.js | - | funService | - | active |
| updateorder | admin | src/commands/admin/updateOrder.js | owner_or_staff | storeOpsService | - | active |
| updatequeue | admin | src/commands/admin/updateQueue.js | joki_crew | storeOpsService | - | active |
| volume | music | src/commands/music/volume.js | - | musicService | - | active |
| warranty-claim | store | src/commands/store/warrantyClaim.js | verified_member | ticketService | - | active |

## Notes

- Guard hint is static analysis from command source and may be combined with runtime guard in handlers/services.
- Status `active` means module loads with valid command shape.
