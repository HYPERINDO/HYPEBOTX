import { Router } from "express";
import { jokiController } from "../controllers/jokiController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { allowedRolesFor } from "../services/roleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function jokiRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole(allowedRolesFor("joki")));
  router.get("/queue", asyncHandler(jokiController.queue));
  router.get("/my-jobs", asyncHandler(jokiController.myJobs));
  router.get("/jobs/:id", asyncHandler(jokiController.detail));
  router.post("/jobs/:id/claim", asyncHandler(jokiController.claim));
  router.post("/jobs/:id/progress", asyncHandler(jokiController.progress));
  router.post("/jobs/:id/submit-done", asyncHandler(jokiController.submitDone));
  router.post("/jobs/:id/approve", requireRole(allowedRolesFor("admin")), asyncHandler(jokiController.approve));
  router.post("/jobs/:id/reject", requireRole(allowedRolesFor("admin")), asyncHandler(jokiController.reject));
  router.post("/jobs/:id/reassign", requireRole(allowedRolesFor("admin")), asyncHandler(jokiController.reassign));
  return router;
}
