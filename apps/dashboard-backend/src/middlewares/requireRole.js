import { auditService } from "../services/auditService.js";
import { fail } from "../utils/response.js";

export function requireRole(allowedRoles) {
  return async function roleGuard(req, res, next) {
    const role = req.session?.user?.role;
    if (!allowedRoles.includes(role)) {
      await auditService.log("UNAUTHORIZED_ACCESS", {
        req,
        targetType: "route",
        targetId: req.originalUrl,
        newValue: { required: allowedRoles, actual: role || null },
      });
      return fail(res, 403, "Akses dashboard ditolak.");
    }
    return next();
  };
}
