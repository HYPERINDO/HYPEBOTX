import { Router } from "express";
import { orderController } from "../controllers/orderController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function orderRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("admin")));
  router.get("/", asyncHandler(orderController.list));
  router.get("/:id", asyncHandler(orderController.detail));
  router.patch("/:id/status", asyncHandler(orderController.updateStatus));
  router.patch("/:id/assign-admin", asyncHandler(orderController.assignAdmin));
  router.patch("/:id/assign-joki", asyncHandler(orderController.assignJoki));
  router.post("/:id/note", asyncHandler(orderController.note));
  router.post("/:id/cancel", asyncHandler(orderController.cancel));
  router.post("/:id/refund", requireRole(allowedRolesFor("owner")), asyncHandler(orderController.refund));
  return router;
}
