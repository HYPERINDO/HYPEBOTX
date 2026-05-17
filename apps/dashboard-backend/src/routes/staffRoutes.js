import { Router } from "express";
import { staffController } from "../controllers/staffController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function staffRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("owner")));
  router.get("/", asyncHandler(staffController.list));
  router.post("/", asyncHandler(staffController.create));
  router.patch("/:id", asyncHandler(staffController.update));
  router.delete("/:id", asyncHandler(staffController.remove));
  router.post("/:id/suspend", asyncHandler(staffController.suspend));
  router.post("/:id/activate", asyncHandler(staffController.activate));
  return router;
}
