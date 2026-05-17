const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  WAITING_PAYMENT: "waiting_payment",
  SUBMITTED: "submitted",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
  PROCESSING: "processing",
  COMPLETED: "completed",
});

const aliases = new Map([
  ["", PAYMENT_STATUS.PENDING],
  ["pending", PAYMENT_STATUS.PENDING],
  ["wait", PAYMENT_STATUS.WAITING_PAYMENT],
  ["waiting", PAYMENT_STATUS.WAITING_PAYMENT],
  ["waiting-payment", PAYMENT_STATUS.WAITING_PAYMENT],
  ["waiting_payment", PAYMENT_STATUS.WAITING_PAYMENT],
  ["waitingpayment", PAYMENT_STATUS.WAITING_PAYMENT],
  ["unpaid", PAYMENT_STATUS.WAITING_PAYMENT],
  ["submitted", PAYMENT_STATUS.SUBMITTED],
  ["proof", PAYMENT_STATUS.SUBMITTED],
  ["review", PAYMENT_STATUS.SUBMITTED],
  ["manual-review", PAYMENT_STATUS.SUBMITTED],
  ["manual_review", PAYMENT_STATUS.SUBMITTED],
  ["approve", PAYMENT_STATUS.PAID],
  ["approved", PAYMENT_STATUS.PAID],
  ["success", PAYMENT_STATUS.PAID],
  ["paid", PAYMENT_STATUS.PAID],
  ["lunas", PAYMENT_STATUS.PAID],
  ["fail", PAYMENT_STATUS.FAILED],
  ["failed", PAYMENT_STATUS.FAILED],
  ["reject", PAYMENT_STATUS.FAILED],
  ["rejected", PAYMENT_STATUS.FAILED],
  ["declined", PAYMENT_STATUS.FAILED],
  ["expired", PAYMENT_STATUS.EXPIRED],
  ["timeout", PAYMENT_STATUS.EXPIRED],
  ["refund", PAYMENT_STATUS.REFUNDED],
  ["refunded", PAYMENT_STATUS.REFUNDED],
  ["cancel", PAYMENT_STATUS.CANCELLED],
  ["canceled", PAYMENT_STATUS.CANCELLED],
  ["cancelled", PAYMENT_STATUS.CANCELLED],
  ["processing", PAYMENT_STATUS.PROCESSING],
  ["process", PAYMENT_STATUS.PROCESSING],
  ["completed", PAYMENT_STATUS.COMPLETED],
  ["complete", PAYMENT_STATUS.COMPLETED],
  ["done", PAYMENT_STATUS.COMPLETED],
]);

const terminalStatuses = new Set([
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.EXPIRED,
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.CANCELLED,
  PAYMENT_STATUS.COMPLETED,
]);

const payableStatuses = new Set([
  PAYMENT_STATUS.PENDING,
  PAYMENT_STATUS.WAITING_PAYMENT,
  PAYMENT_STATUS.SUBMITTED,
]);

function normalizePaymentStatus(raw, fallback = PAYMENT_STATUS.PENDING) {
  const value = String(raw ?? "").trim().toLowerCase();
  return aliases.get(value) || fallback;
}

function isPaymentTerminal(raw) {
  return terminalStatuses.has(normalizePaymentStatus(raw));
}

function isPaymentPayable(raw) {
  return payableStatuses.has(normalizePaymentStatus(raw));
}

function isPaymentPaid(raw) {
  return normalizePaymentStatus(raw) === PAYMENT_STATUS.PAID;
}

module.exports = {
  PAYMENT_STATUS,
  isPaymentPaid,
  isPaymentPayable,
  isPaymentTerminal,
  normalizePaymentStatus,
};
