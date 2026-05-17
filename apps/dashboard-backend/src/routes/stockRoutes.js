import { Router } from "express";
import { stockController } from "../controllers/stockController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function stockRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("admin")));
  router.get("/", asyncHandler(stockController.stock));
  router.post("/", asyncHandler(stockController.createStock));
  router.patch("/:id", asyncHandler(stockController.updateStock));
  router.delete("/:id", requireRole(allowedRolesFor("owner")), asyncHandler(stockController.deleteStock));
  router.post("/:id/reserve", asyncHandler(stockController.reserve));
  router.post("/:id/mark-sold", asyncHandler(stockController.markSold));
  return router;
}
