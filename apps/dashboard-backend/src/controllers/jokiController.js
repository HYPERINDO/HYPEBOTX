import { JOKI_STATUS } from "@hypebotx/shared";
import { auditService } from "../services/auditService.js";
import { jokiRepository } from "../repositories/jokiRepository.js";
import { fail, ok } from "../utils/response.js";

function isOwnJob(user, job) {
  const ids = [job?.assigned_joki_id, job?.assignedJokiId, job?.claimedBy, job?.userId].map(String);
  return ids.includes(String(user.discordId));
}

export const jokiController = {
  async queue(_req, res) {
    return ok(res, { queue: await jokiRepository.listJobs() });
  },
  async myJobs(req, res) {
    const jobs = await jokiRepository.listJobs();
    const scoped = req.session.user.role === "penjoki" ? jobs.filter((job) => isOwnJob(req.session.user, job)) : jobs;
    return ok(res, { jobs: scoped });
  },
  async detail(req, res) {
    const job = await jokiRepository.findJob(req.params.id);
    if (!job) return fail(res, 404, "Job tidak ditemukan.");
    if (req.session.user.role === "penjoki" && !isOwnJob(req.session.user, job)) return fail(res, 403, "Penjoki hanya bisa melihat job sendiri.");
    return ok(res, { job });
  },
  async claim(req, res) {
    const job = await jokiRepository.updateJob(req.params.id, { status: JOKI_STATUS.CLAIMED, claimedBy: req.session.user.discordId, claimedAt: new Date().toISOString() });
    await auditService.log("JOKI_JOB_CLAIMED", { req, targetType: "joki_job", targetId: req.params.id, newValue: job });
    return job ? ok(res, { job }) : fail(res, 404, "Job tidak ditemukan.");
  },
  async progress(req, res) {
    const job = await jokiRepository.updateJob(req.params.id, { status: req.body.status || JOKI_STATUS.ON_PROGRESS, progress_note: req.body.note || null });
    await auditService.log("JOKI_PROGRESS_UPDATED", { req, targetType: "joki_job", targetId: req.params.id, newValue: job });
    return job ? ok(res, { job }) : fail(res, 404, "Job tidak ditemukan.");
  },
  async submitDone(req, res) {
    const job = await jokiRepository.updateJob(req.params.id, { status: JOKI_STATUS.SUBMITTED_DONE, proof_url: req.body.proofUrl || null, admin_review_status: "pending" });
    await auditService.log("JOKI_SUBMITTED_DONE", { req, targetType: "joki_job", targetId: req.params.id, newValue: job });
    return job ? ok(res, { job }) : fail(res, 404, "Job tidak ditemukan.");
  },
  async approve(req, res) {
    const job = await jokiRepository.updateJob(req.params.id, { status: JOKI_STATUS.APPROVED, admin_review_status: "approved" });
    await auditService.log("JOKI_APPROVED", { req, targetType: "joki_job", targetId: req.params.id, newValue: job });
    return job ? ok(res, { job }) : fail(res, 404, "Job tidak ditemukan.");
  },
  async reject(req, res) {
    const job = await jokiRepository.updateJob(req.params.id, { status: JOKI_STATUS.REJECTED, admin_review_status: "rejected", reject_reason: req.body.reason || null });
    await auditService.log("JOKI_REJECTED", { req, targetType: "joki_job", targetId: req.params.id, newValue: job });
    return job ? ok(res, { job }) : fail(res, 404, "Job tidak ditemukan.");
  },
  async reassign(req, res) {
    const job = await jokiRepository.updateJob(req.params.id, { assigned_joki_id: req.body.jokiId });
    await auditService.log("JOKI_REASSIGNED", { req, targetType: "joki_job", targetId: req.params.id, newValue: job });
    return job ? ok(res, { job }) : fail(res, 404, "Job tidak ditemukan.");
  },
};
