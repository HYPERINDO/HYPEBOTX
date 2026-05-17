function createPayment(payload) {
  return {
    id: payload.id,
    guildId: payload.guildId,
    userId: payload.userId,
    orderId: payload.orderId || null,
    ticketId: payload.ticketId || null,
    status: payload.status || "submitted",
    method: payload.method || "unknown",
    amount: payload.amount || "",
    note: payload.note || "",
    proofUrls: payload.proofUrls || [],
    messageId: payload.messageId || null,
    channelId: payload.channelId || null,
    checkedBy: payload.checkedBy || null,
    checkedAt: payload.checkedAt || null,
    lastReminderAt: payload.lastReminderAt || null,
    reminderCount: Number.isFinite(Number(payload.reminderCount)) ? Number(payload.reminderCount) : 0,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

module.exports = {
  createPayment,
};
