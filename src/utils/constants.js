module.exports = {
  componentIds: {
    verifyButton: "verify:member",
    ticketClaim: "ticket:claim",
    ticketClose: "ticket:close",
    ticketCloseConfirmPrefix: "ticket:close:confirm:",
    ticketCloseCancelPrefix: "ticket:close:cancel:",
    ticketOrderButton: "ticket:order",
    roleSelect: "role:self",
    ticketTypeSelect: "ticket:type",
    orderStatusSelect: "order:status",
    paymentProofButton: "payment:proof",
    orderFormButton: "order:form",
    topupFormButton: "topup:form",
    warrantyButton: "warranty:form",
    orderFormModal: "modal:order-form",
    topupFormModal: "modal:topup-form",
    warrantyModal: "modal:warranty-form",
    giveawayJoinPrefix: "giveaway:join:",

    // Customer Simple Mode menu (entry buttons)
    customerSimpleOrderButton: "customer:simple:order",
    customerSimpleCheckButton: "customer:simple:check-order",
    customerSimplePaymentButton: "customer:simple:payment",
    customerSimpleAdminHelpButton: "customer:simple:admin-help",

    // Checkout flow (website-like step-by-step order)
    orderStart: "order:start",
    orderServiceSelect: "order:service_select",
    orderProductSelect: "order:product_select",
    orderPackageSelect: "order:package_select",
    orderMethodSelect: "order:method_select",
    orderNeedTypeSelect: "order:need_type_select",
    orderPaymentSelect: "order:payment_select",
    orderConfirmInvoice: "order:confirm_invoice",
    orderCustomerConfirm: "order:customer_confirm",
    orderAdminConfirm: "order:admin_confirm",
    orderCancel: "order:cancel",
    orderBack: "order:back",

    // Checkout modals (service-specific forms)
    orderJokiModal: "order:joki_modal",
    orderTopupModal: "order:topup_modal",
    orderWindowsModal: "order:windows_modal",
    orderOfficeModal: "order:office_modal",
    orderGameAccountModal: "order:game_account_modal",

    // Customer Simple Mode navigator (global within order ticket)
    customerNavBackButton: "customer:nav:back",
    customerNavRepeatButton: "customer:nav:repeat",
    customerNavAdminHelpButton: "customer:nav:admin-help",

    // Admin panel (button-first)
    adminPanelButton: "admin:panel:open",
    adminNavOrdersButton: "admin:panel:orders",
    adminNavTicketsButton: "admin:panel:tickets",
    adminNavPaymentsButton: "admin:panel:payments",
    adminNavStaffButton: "admin:panel:staff",
    adminNavPromoButton: "admin:panel:promo",
    adminNavChatbotButton: "admin:panel:chatbot",
    adminNavAnalyticsButton: "admin:panel:analytics",
    adminNavSettingsButton: "admin:panel:settings",

    // Setup Wizard (admin, button/select)
    setupWizardButton: "admin:setup:wizard",
    setupModeSelect: "admin:setup:mode",
    setupConfirmButton: "admin:setup:confirm",
    setupBackToAdminPanelButton: "admin:setup:back",

    // Joki (queue system)
    jokiClaimPrefix: "joki:claim:",
    jokiStartPrefix: "joki:start:",
    jokiPausePrefix: "joki:pause:",
    jokiFinishPrefix: "joki:finish:",

    // New order format modals
    windowsLicenseModal: "modal:windows-license",
    officeLicenseModal: "modal:office-license",
    optimizerModal: "modal:optimizer",
    gameAccountModal: "modal:game-account",
    gtaAccountModal: "modal:gta-account",
    discordServerModal: "modal:discord-server",
    bundlePackageModal: "modal:bundle-package",

    // Payment / Warranty decision buttons (SPRINT 1)
    paymentApprovePrefix: "payment:approve:",
    paymentRejectPrefix: "payment:reject:",
    warrantyAcceptPrefix: "warranty:accept:",
    warrantyRejectPrefix: "warranty:reject:",
    warrantyNeedProofPrefix: "warranty:needproof:",

    // Modal IDs (reasons)
    modalPaymentRejectReason: "modal:payment-reject-reason",
    modalWarrantyNeedProofReason: "modal:warranty-needproof-reason",

    // Format display buttons
    formatJoki: "format:joki",
    formatTopup: "format:topup",
    formatWindows: "format:windows",
    formatOffice: "format:office",
    formatOptimizer: "format:optimizer",
    formatGameaccount: "format:gameaccount",
    formatGta: "format:gta",
    formatDiscord: "format:discord",
    formatBundle: "format:bundle",
    formatWarranty: "format:warranty",

    // Backlog buttons
    termsAcceptButton: "terms:accept",
    quickActionSummary: "quick:summary",
    quickActionInvoice: "quick:invoice",
    quickActionMarkPaid: "quick:paid",
    quickActionMarkProcessing: "quick:processing",
    quickActionMarkCompleted: "quick:completed",
    quickActionCloseTicket: "quick:close-ticket",

    // Batch 2 Engagement
    testimoniButton: "testimoni:prompt",
    testimoniModal: "modal:testimoni-form",

    // Price list browsing
    priceCategorySelect: "price_category_select",
  },
  orderStatuses: [
    "pending",
    "queued",
    "waiting",
    "waiting-payment",
    "paid",
    "processing",
    "hold",
    "completed",
    "cancelled",
    "refunded",
    "refund",
  ],
  ticketTypes: ["order", "payment", "support", "warranty", "partnership"],
  categoryKeywords: {
    INFO: ["welcome", "rules", "announcements", "faq", "choose-role", "verify", "social-links"],
    STORE: ["price-list", "promo", "stock-update", "account-showcase", "account-estalase", "payment-method", "payment-methode", "payment-proof", "claim-warranty"],
    PRODUCTS: ["steam-products", "rockstar-products", "epic-products", "produk-steam", "produk-epic", "produk-rockstar", "windows-office-key", "key-license-win-plus-office", "produk", "windows office", "optimizer-windows", "game-boosting", "joki-game", "game-top-up", "top-up-game", "account-market", "jual-akun", "account-settings", "setting-account"],
    "ORDER CENTER": ["open-ticket", "how-to-order", "order-panel", "order-status", "status-order", "queue-list", "report-problem", "payment-check", "customer-complaints", "komplain-customer"],
    "PC OPTIMIZER": ["pc-consultation", "optimization-tips", "tips-optimization", "hyperboostx-info", "info-app-hyperboostx", "optimizer-service", "optimizer-results", "optimizer-result", "optimizer-testimonials", "testimoni-optimizer"],
    "GTA SERVICES": ["gta-chat", "gta-info", "legacy-service", "enhanced-service", "legacy", "enhanced", "gta-discussion", "gta-testimonials", "gta-boosting-testimonials", "testimoni-joki-gta"],
    COMMUNITY: ["community-chat", "content", "music-request", "bot-games", "media-share"],
    EVENTS: ["store-events", "registered-event", "giveaway", "event-winner"],
    "STREAM AREA": ["live-notification", "stream-schedule", "stream-chat", "live-accounts", "akun-live"],
    "SERVER LOGS": ["bot-log", "bot-logs", "moderation-log", "moderation-logs", "admin-logs", "join-leave-logs", "staff-logs", "staff-log", "update-bot", "ticket-logs", "order-logs", "payment-logs", "payment-log", "incoming-orders", "completed-orders", "order-masuk", "order-selesai"],
    "SERVER STATS": ["members", "all members", "bots"],
    "ACTIVE TICKETS": ["ticket-", "order-\\d{4}", "ticket-ord-"],
    "CLOSED TICKETS": ["closed-"],
    "VOICE LOUNGE": ["voice", "music", "room legacy", "room enhanced", "joki legacy", "joki enhanced", "boosting legacy", "boosting enhanced", "chill room", "music room", "admin room", "dev room", "staff voice", "public voice"],
    "STAFF AREA": ["staff", "admin", "operator", "mod", "staff-chat", "admin-chat", "operator-guide", "command-dev", "testing-command", "bot-testing", "bug-report"],
  },
  blockedWords: ["nitro gratis", "free nitro", "scam link", "discord gift"],
  scamDomains: ["discord-gifts", "gift-discord", "steamcommunity.ru", "st3am"],
};
