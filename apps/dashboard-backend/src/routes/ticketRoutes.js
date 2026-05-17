import { Router } from "express";
import { ticketController } from "../controllers/ticketController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function ticketRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("admin")));
  router.get("/", asyncHandler(ticketController.list));
  router.get("/:id", asyncHandler(ticketController.detail));
  router.post("/:id/claim", asyncHandler(ticketController.claim));
  router.post("/:id/close", asyncHandler(ticketController.close));
  router.post("/:id/reopen", asyncHandler(ticketController.reopen));
  router.post("/:id/note", asyncHandler(ticketController.note));
  return router;
}
