import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { rateLimiter } from "../middlewares/rateLimiter.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function authRoutes() {
  const router = Router();
  router.get("/discord", rateLimiter({ max: 20 }), authController.discord);
  router.get("/discord/callback", rateLimiter({ max: 20 }), asyncHandler(authController.callback));
  router.get("/me", requireAuth, authController.me);
  router.post("/logout", asyncHandler(authController.logout));
  return router;
}
