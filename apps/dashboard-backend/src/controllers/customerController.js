import { auditService } from "../services/auditService.js";
import { userRepository } from "../repositories/userRepository.js";
import { fail, ok } from "../utils/response.js";

export const customerController = {
  async list(_req, res) {
    return ok(res, { customers: await userRepository.list() });
  },
  async detail(req, res) {
    const customer = await userRepository.findByDiscordId(req.params.id);
    return customer ? ok(res, { customer }) : fail(res, 404, "Customer tidak ditemukan.");
  },
  async note(req, res) {
    const customer = await userRepository.upsertStaff({ discordId: req.params.id, internal_note: req.body.note || "" });
    await auditService.log("CUSTOMER_NOTE_ADDED", { req, targetType: "customer", targetId: req.params.id, newValue: { note: req.body.note } });
    return ok(res, { customer });
  },
  async blacklistRequest(req, res) {
    await auditService.log("BLACKLIST_REQUESTED", { req, targetType: "customer", targetId: req.params.id, newValue: { reason: req.body.reason || "" } });
    return ok(res, { requested: true }, 202);
  },
};
