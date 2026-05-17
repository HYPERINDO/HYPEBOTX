import { ROLES } from "../constants/roles.js";

export const PERMISSIONS = {
  OVERVIEW_REVENUE: "overview:revenue",
  ORDER_MONITOR: "orders:monitor",
  ORDER_OWN_JOB: "orders:own-job",
  PAYMENT_MONITOR: "payments:monitor",
  PAYMENT_APPROVE: "payments:approve",
  REFUND: "orders:refund",
  TICKET_MONITOR: "tickets:monitor",
  JOKI_QUEUE_ALL: "joki:queue-all",
  JOKI_CLAIM: "joki:claim",
  JOKI_ASSIGN: "joki:assign",
  JOKI_PROGRESS: "joki:progress",
  JOKI_APPROVE_DONE: "joki:approve-done",
  STOCK_MONITOR: "stock:monitor",
  STOCK_EDIT: "stock:edit",
  PRICELIST_EDIT: "pricelist:edit",
  PRODUCT_EDIT: "products:edit",
  STAFF_MANAGER: "staff:manager",
  CUSTOMER_MANAGER: "customers:manager",
  BOT_MONITOR: "bot:monitor",
  BOT_CONTROL: "bot:control",
  LOGS_VIEWER: "logs:viewer",
  AI_USAGE_MONITOR: "ai:usage",
  BACKUP_EXPORT: "backup:export",
  SETTINGS: "settings:manage",
  AUDIT_LOG: "audit:read",
};

export const PERMISSION_MATRIX = {
  [ROLES.OWNER]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.OVERVIEW_REVENUE,
    PERMISSIONS.ORDER_MONITOR,
    PERMISSIONS.PAYMENT_MONITOR,
    PERMISSIONS.PAYMENT_APPROVE,
    PERMISSIONS.TICKET_MONITOR,
    PERMISSIONS.JOKI_QUEUE_ALL,
    PERMISSIONS.JOKI_CLAIM,
    PERMISSIONS.JOKI_ASSIGN,
    PERMISSIONS.JOKI_PROGRESS,
    PERMISSIONS.JOKI_APPROVE_DONE,
    PERMISSIONS.STOCK_MONITOR,
    PERMISSIONS.STOCK_EDIT,
    PERMISSIONS.CUSTOMER_MANAGER,
    PERMISSIONS.BOT_MONITOR,
    PERMISSIONS.LOGS_VIEWER,
    PERMISSIONS.AUDIT_LOG,
  ],
  [ROLES.PENJOKI]: [
    PERMISSIONS.ORDER_OWN_JOB,
    PERMISSIONS.JOKI_CLAIM,
    PERMISSIONS.JOKI_PROGRESS,
  ],
};

export function hasPermission(role, permission) {
  return Boolean(PERMISSION_MATRIX[role]?.includes(permission));
}

export function canAccessRole(userRole, allowedRoles = []) {
  if (!allowedRoles.length) return true;
  return allowedRoles.includes(userRole);
}
