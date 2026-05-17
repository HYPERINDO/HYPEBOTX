export const ORDER_STATUS = {
  PENDING: "pending",
  WAITING_PAYMENT: "waiting_payment",
  PAID: "paid",
  PROCESSING: "processing",
  WAITING_ADMIN: "waiting_admin",
  WAITING_JOKI: "waiting_joki",
  ON_PROGRESS: "on_progress",
  ADMIN_REVIEW: "admin_review",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);
