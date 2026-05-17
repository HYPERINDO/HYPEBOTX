function createUser(payload) {
  return {
    guildId: payload.guildId,
    userId: payload.userId,
    username: payload.username || "",
    roles: payload.roles || [],
    totalOrder: payload.totalOrder || 0,
    totalSpent: payload.totalSpent || 0,
    status: payload.status || "normal",
    tier: payload.tier || "new",
    blacklistReason: payload.blacklistReason || "",
    warrantyCount: payload.warrantyCount || 0,
    disputeCount: payload.disputeCount || 0,
    refundCount: payload.refundCount || 0,
    lastOrderAt: payload.lastOrderAt || null,
    notes: payload.notes || "",
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };
}

module.exports = {
  createUser,
};
