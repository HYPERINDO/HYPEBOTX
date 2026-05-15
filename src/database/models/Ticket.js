function createTicket(payload) {
  return {
    id: payload.id,
    guildId: payload.guildId,
    channelId: payload.channelId,
    openerId: payload.openerId,
    type: payload.type,
    status: payload.status || "open",
    claimedBy: payload.claimedBy || null,
    orderStatus: payload.orderStatus || "pending",
    meta: payload.meta || {},
    createdAt: payload.createdAt || new Date().toISOString(),
    closedAt: payload.closedAt || null,
  };
}

module.exports = {
  createTicket,
};
