import { auditService } from "../services/auditService.js";

export function auditAction(action, targetType = "api") {
  return async function auditMiddleware(req, _res, next) {
    await auditService.log(action, {
      req,
      targetType,
      targetId: req.params.id || req.originalUrl,
      newValue: req.body || null,
    });
    return next();
  };
}
