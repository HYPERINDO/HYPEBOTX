import { Router } from "express";
import { auditController } from "../controllers/auditController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function auditRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("admin")));
  router.get("/", asyncHandler(auditController.list));
  return router;
}
