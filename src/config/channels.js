module.exports = {
  verifyVisibleChannels: ["welcome", "rules", "verify", "choose-role"],
  logChannels: {
    order: "order-logs",
    payment: process.env.PAYMENT_LOG_CHANNEL_NAME || "payment-logs",
    moderation: "moderation-logs",
    ticket: "ticket-logs",
    bot: "bot-logs",
    joinLeave: "join-leave-logs",
    admin: "admin-logs",
    staff: "admin-logs",
    updateBot: "bot-logs",

    // new required channels for security/logging hardening
    security: "admin-logs",
    runtime: "bot-logs",
    error: "bot-logs",
  },
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || "",
  useTicketThreads: (process.env.TICKET_USE_THREADS || "true").toLowerCase() !== "false",
  ticketThreadParentChannelId: process.env.TICKET_THREAD_PARENT_CHANNEL_ID || "",
  defaultTicketCategory: process.env.TICKET_CATEGORY_NAME || "ACTIVE TICKETS",
  closedTicketCategory: process.env.CLOSED_TICKET_CATEGORY_NAME || "CLOSED TICKETS",
  staffCategory: "STAFF AREA",
};
