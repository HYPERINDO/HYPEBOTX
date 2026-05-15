function createOrder(payload) {
  return {
    id: payload.id,
    guildId: payload.guildId,
    ticketId: payload.ticketId,
    userId: payload.userId,

    // customer/profile
    customerName: payload.customerName || "",
    category: payload.category || payload.formType || "general",
    product: payload.product || "unknown",
    packageName: payload.packageName || "",
    sku: payload.sku || null,
    price: payload.price || payload.amount || "",

    // payment lifecycle
    paymentStatus: payload.paymentStatus || "unpaid",

    // staff + notes
    staffHandle: payload.staffHandle || null,
    adminNote: payload.adminNote || "",
    detail: payload.detail || "",

    status: payload.status || "pending",

    // Priority 1: Order Summary & Invoice automation
    // We store message IDs so we can edit the same embeds (spec: “edit embed order summary yang sama”)
    orderSummaryMessageId: payload.orderSummaryMessageId || null,
    invoiceMessageId: payload.invoiceMessageId || null,

    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };
}

module.exports = {
  createOrder,
};
