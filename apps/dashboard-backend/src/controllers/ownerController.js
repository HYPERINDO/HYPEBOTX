import { dashboardDataService } from "../services/dashboardDataService.js";
import { auditService } from "../services/auditService.js";
import { auditRepository } from "../repositories/auditRepository.js";
import { ok } from "../utils/response.js";

export const ownerController = {
  async overview(req, res) {
    return ok(res, await dashboardDataService.overview(req.session.user.role, req.session.user.discordId));
  },
  async auditLogs(_req, res) {
    return ok(res, { auditLogs: await auditRepository.list() });
  },
  botStatus(_req, res) {
    return ok(res, {
      status: {
        service: "hypebotx-bot",
        online: true,
        mode: "external-pm2",
      },
    });
  },
  async botAction(req, res) {
    await auditService.log(`BOT_${req.params.action.toUpperCase()}_REQUESTED`, {
      req,
      targetType: "bot",
      targetId: "hypebotx-bot",
    });
    return ok(res, { queued: true, action: req.params.action }, 202);
  },
  aiUsage(_req, res) {
    return ok(res, { usage: [] });
  },
  async backup(req, res) {
    await auditService.log("BACKUP_REQUESTED", { req, targetType: "backup" });
    return ok(res, { queued: true }, 202);
  },
};
