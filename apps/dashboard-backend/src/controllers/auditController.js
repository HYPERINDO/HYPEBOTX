import { auditRepository } from "../repositories/auditRepository.js";
import { ok } from "../utils/response.js";

export const auditController = {
  async list(_req, res) {
    return ok(res, { auditLogs: await auditRepository.list() });
  },
};
