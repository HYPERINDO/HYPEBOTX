import { PAYMENT_STATUS } from "@hypebotx/shared";
import { auditService } from "../services/auditService.js";
import { paymentRepository } from "../repositories/paymentRepository.js";
import { fail, ok } from "../utils/response.js";

export const paymentController = {
  async list(_req, res) {
    return ok(res, { payments: await paymentRepository.list() });
  },
  async detail(req, res) {
    const payment = await paymentRepository.findById(req.params.id);
    return payment ? ok(res, { payment }) : fail(res, 404, "Payment tidak ditemukan.");
  },
  async approve(req, res) {
    const payment = await paymentRepository.updateById(req.params.id, { status: PAYMENT_STATUS.PAID, paid_at: new Date().toISOString() });
    await auditService.log("PAYMENT_APPROVED", { req, targetType: "payment", targetId: req.params.id, newValue: payment });
    return payment ? ok(res, { payment }) : fail(res, 404, "Payment tidak ditemukan.");
  },
  async reject(req, res) {
    const payment = await paymentRepository.updateById(req.params.id, { status: PAYMENT_STATUS.REJECTED, reject_reason: req.body.reason || null });
    await auditService.log("PAYMENT_REJECTED", { req, targetType: "payment", targetId: req.params.id, newValue: payment });
    return payment ? ok(res, { payment }) : fail(res, 404, "Payment tidak ditemukan.");
  },
  async sync(req, res) {
    await auditService.log("PAYMENT_SYNCED", { req, targetType: "payment", targetId: req.params.id });
    return ok(res, { synced: true });
  },
};
