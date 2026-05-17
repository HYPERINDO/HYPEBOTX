import { auditService } from "../services/auditService.js";
import { ticketRepository } from "../repositories/ticketRepository.js";
import { fail, ok } from "../utils/response.js";

export const ticketController = {
  async list(_req, res) {
    return ok(res, { tickets: await ticketRepository.list() });
  },
  async detail(req, res) {
    const ticket = await ticketRepository.findById(req.params.id);
    return ticket ? ok(res, { ticket }) : fail(res, 404, "Ticket tidak ditemukan.");
  },
  async claim(req, res) {
    const ticket = await ticketRepository.updateById(req.params.id, { claimed_by: req.session.user.discordId });
    await auditService.log("TICKET_CLAIMED", { req, targetType: "ticket", targetId: req.params.id, newValue: ticket });
    return ticket ? ok(res, { ticket }) : fail(res, 404, "Ticket tidak ditemukan.");
  },
  async close(req, res) {
    const ticket = await ticketRepository.updateById(req.params.id, { status: "closed", closed_by: req.session.user.discordId, closed_at: new Date().toISOString() });
    await auditService.log("TICKET_CLOSED", { req, targetType: "ticket", targetId: req.params.id, newValue: ticket });
    return ticket ? ok(res, { ticket }) : fail(res, 404, "Ticket tidak ditemukan.");
  },
  async reopen(req, res) {
    const ticket = await ticketRepository.updateById(req.params.id, { status: "open", closed_by: null, closed_at: null });
    await auditService.log("TICKET_REOPENED", { req, targetType: "ticket", targetId: req.params.id, newValue: ticket });
    return ticket ? ok(res, { ticket }) : fail(res, 404, "Ticket tidak ditemukan.");
  },
  async note(req, res) {
    await auditService.log("TICKET_NOTE_ADDED", { req, targetType: "ticket", targetId: req.params.id, newValue: { note: req.body.note } });
    return ok(res, { saved: true });
  },
};
