import { ORDER_STATUS } from "@hypebotx/shared";
import { auditService } from "../services/auditService.js";
import { orderRepository } from "../repositories/orderRepository.js";
import { fail, ok } from "../utils/response.js";

export const orderController = {
  async list(_req, res) {
    return ok(res, { orders: await orderRepository.list() });
  },
  async detail(req, res) {
    const order = await orderRepository.findById(req.params.id);
    return order ? ok(res, { order }) : fail(res, 404, "Order tidak ditemukan.");
  },
  async updateStatus(req, res) {
    const before = await orderRepository.findById(req.params.id);
    const order = await orderRepository.updateById(req.params.id, { status: req.body.status });
    if (!order) return fail(res, 404, "Order tidak ditemukan.");
    await auditService.log("ORDER_STATUS_CHANGED", { req, targetType: "order", targetId: req.params.id, oldValue: before, newValue: order });
    return ok(res, { order });
  },
  async assignAdmin(req, res) {
    const order = await orderRepository.updateById(req.params.id, { assigned_admin_id: req.body.adminId });
    await auditService.log("ORDER_ASSIGNED_ADMIN", { req, targetType: "order", targetId: req.params.id, newValue: order });
    return order ? ok(res, { order }) : fail(res, 404, "Order tidak ditemukan.");
  },
  async assignJoki(req, res) {
    const order = await orderRepository.updateById(req.params.id, { assigned_joki_id: req.body.jokiId, status: ORDER_STATUS.WAITING_JOKI });
    await auditService.log("ORDER_ASSIGNED_JOKI", { req, targetType: "order", targetId: req.params.id, newValue: order });
    return order ? ok(res, { order }) : fail(res, 404, "Order tidak ditemukan.");
  },
  async note(req, res) {
    const order = await orderRepository.updateById(req.params.id, { notes: req.body.note });
    await auditService.log("ORDER_UPDATED", { req, targetType: "order", targetId: req.params.id, newValue: { note: req.body.note } });
    return order ? ok(res, { order }) : fail(res, 404, "Order tidak ditemukan.");
  },
  async cancel(req, res) {
    const order = await orderRepository.updateById(req.params.id, { status: ORDER_STATUS.CANCELLED });
    await auditService.log("ORDER_CANCELLED", { req, targetType: "order", targetId: req.params.id, newValue: order });
    return order ? ok(res, { order }) : fail(res, 404, "Order tidak ditemukan.");
  },
  async refund(req, res) {
    const order = await orderRepository.updateById(req.params.id, { status: ORDER_STATUS.REFUNDED, payment_status: "refunded" });
    await auditService.log("ORDER_REFUNDED", { req, targetType: "order", targetId: req.params.id, newValue: order });
    return order ? ok(res, { order }) : fail(res, 404, "Order tidak ditemukan.");
  },
};
