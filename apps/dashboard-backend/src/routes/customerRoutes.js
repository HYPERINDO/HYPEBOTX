import { Router } from "express";
import { customerController } from "../controllers/customerController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function customerRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("admin")));
  router.get("/", asyncHandler(customerController.list));
  router.get("/:id", asyncHandler(customerController.detail));
  router.post("/:id/note", asyncHandler(customerController.note));
  router.post("/:id/blacklist-request", asyncHandler(customerController.blacklistRequest));
  return router;
}
