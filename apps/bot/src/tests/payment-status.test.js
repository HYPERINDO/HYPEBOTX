const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PAYMENT_STATUS,
  isPaymentPaid,
  isPaymentPayable,
  isPaymentTerminal,
  normalizePaymentStatus,
} = require("../utils/paymentStatus");

test("payment status normalizes common aliases", () => {
  assert.equal(normalizePaymentStatus("WAITING-PAYMENT"), PAYMENT_STATUS.WAITING_PAYMENT);
  assert.equal(normalizePaymentStatus("unpaid"), PAYMENT_STATUS.WAITING_PAYMENT);
  assert.equal(normalizePaymentStatus("manual-review"), PAYMENT_STATUS.SUBMITTED);
  assert.equal(normalizePaymentStatus("approved"), PAYMENT_STATUS.PAID);
  assert.equal(normalizePaymentStatus("reject"), PAYMENT_STATUS.FAILED);
  assert.equal(normalizePaymentStatus("canceled"), PAYMENT_STATUS.CANCELLED);
});

test("payment status helpers separate payable and terminal states", () => {
  assert.equal(isPaymentPayable("pending"), true);
  assert.equal(isPaymentPayable("submitted"), true);
  assert.equal(isPaymentTerminal("submitted"), false);
  assert.equal(isPaymentTerminal("paid"), true);
  assert.equal(isPaymentTerminal("expired"), true);
  assert.equal(isPaymentPaid("lunas"), true);
});
