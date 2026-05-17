import { Router } from "express";
import { paymentController } from "../controllers/paymentController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function paymentRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("admin")));
  router.get("/", asyncHandler(paymentController.list));
  router.get("/:id", asyncHandler(paymentController.detail));
  router.post("/:id/approve", asyncHandler(paymentController.approve));
  router.post("/:id/reject", asyncHandler(paymentController.reject));
  router.post("/:id/sync", asyncHandler(paymentController.sync));
  return router;
}
