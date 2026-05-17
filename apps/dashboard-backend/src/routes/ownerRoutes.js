import { Router } from "express";
import { ownerController } from "../controllers/ownerController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function ownerRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("owner")));
  router.get("/overview", asyncHandler(ownerController.overview));
  router.get("/stats", asyncHandler(ownerController.overview));
  router.get("/audit-logs", asyncHandler(ownerController.auditLogs));
  router.get("/bot-status", ownerController.botStatus);
  router.post("/bot/:action(start|stop|restart)", asyncHandler(ownerController.botAction));
  router.post("/backup", asyncHandler(ownerController.backup));
  router.get("/ai-usage", ownerController.aiUsage);
  return router;
}
