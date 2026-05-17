import { auditRepository } from "../repositories/auditRepository.js";

function clientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim() || req.socket?.remoteAddress || null;
}

export const auditService = {
  async log(action, { req = null, actor = null, targetType = "system", targetId = null, oldValue = null, newValue = null } = {}) {
    const sessionUser = req?.session?.user;
    const activeActor = actor || sessionUser || null;
    const row = {
      actor_id: activeActor?.userId || activeActor?.discordId || null,
      actor_role: activeActor?.role || null,
      actor_username: activeActor?.username || null,
      action,
      target_type: targetType,
      target_id: targetId,
      old_value: oldValue === null || oldValue === undefined ? null : JSON.stringify(oldValue).slice(0, 2000),
      new_value: newValue === null || newValue === undefined ? null : JSON.stringify(newValue).slice(0, 2000),
      ip_address: req ? clientIp(req) : null,
      created_at: new Date().toISOString(),
    };

    try {
      return await auditRepository.create(row);
    } catch (error) {
      console.warn("audit log failed", error?.message || error);
      return row;
    }
  },
};
