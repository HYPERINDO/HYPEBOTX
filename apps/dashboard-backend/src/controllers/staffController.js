import { auditService } from "../services/auditService.js";
import { userRepository } from "../repositories/userRepository.js";
import { fail, ok } from "../utils/response.js";

export const staffController = {
  async list(_req, res) {
    const staff = (await userRepository.list()).filter((row) => ["owner", "admin", "penjoki"].includes(row.role));
    return ok(res, { staff });
  },
  async create(req, res) {
    if (!req.body.discordId || !req.body.role) return fail(res, 400, "discordId dan role wajib diisi.");
    const staff = await userRepository.upsertStaff(req.body);
    await auditService.log("STAFF_CREATED", { req, targetType: "staff", targetId: staff.discordId, newValue: staff });
    return ok(res, { staff }, 201);
  },
  async update(req, res) {
    const staff = await userRepository.updateById(req.params.id, req.body || {});
    await auditService.log("STAFF_ROLE_CHANGED", { req, targetType: "staff", targetId: req.params.id, newValue: staff });
    return staff ? ok(res, { staff }) : fail(res, 404, "Staff tidak ditemukan.");
  },
  async suspend(req, res) {
    const staff = await userRepository.updateById(req.params.id, { status: "suspended" });
    await auditService.log("STAFF_SUSPENDED", { req, targetType: "staff", targetId: req.params.id, newValue: staff });
    return staff ? ok(res, { staff }) : fail(res, 404, "Staff tidak ditemukan.");
  },
  async activate(req, res) {
    const staff = await userRepository.updateById(req.params.id, { status: "active" });
    await auditService.log("STAFF_ACTIVATED", { req, targetType: "staff", targetId: req.params.id, newValue: staff });
    return staff ? ok(res, { staff }) : fail(res, 404, "Staff tidak ditemukan.");
  },
  async remove(req, res) {
    const staff = await userRepository.updateById(req.params.id, { status: "inactive" });
    await auditService.log("STAFF_DELETED", { req, targetType: "staff", targetId: req.params.id, newValue: staff });
    return staff ? ok(res, { staff }) : fail(res, 404, "Staff tidak ditemukan.");
  },
};
