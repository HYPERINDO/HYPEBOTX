import { Router } from "express";
import { stockController } from "../controllers/stockController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function pricelistRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("admin")));
  router.get("/", asyncHandler(stockController.products));
  router.post("/", requireRole(allowedRolesFor("owner")), asyncHandler(stockController.createProduct));
  router.patch("/:id", requireRole(allowedRolesFor("owner")), asyncHandler(stockController.updateProduct));
  router.delete("/:id", requireRole(allowedRolesFor("owner")), asyncHandler(stockController.deleteProduct));
  return router;
}
