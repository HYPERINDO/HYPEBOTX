import { Router } from "express";
import { auditRepository } from "../repositories/auditRepository.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";

const prefixes = {
  order: "ORDER_",
  payment: "PAYMENT_",
  ticket: "TICKET_",
  error: "ERROR_",
};

export function logRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("admin")));
  router.get("/:type(order|payment|ticket|error)", asyncHandler(async (req, res) => {
    const prefix = prefixes[req.params.type];
    const logs = (await auditRepository.list()).filter((row) => String(row.action || "").startsWith(prefix));
    return ok(res, { logs });
  }));
  return router;
}
