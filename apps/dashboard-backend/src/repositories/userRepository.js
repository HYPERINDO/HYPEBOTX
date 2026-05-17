import { STAFF_STATUS } from "@hypebotx/shared";
import { botDataFile } from "../config/database.js";
import { createCollectionRepository } from "./jsonFileRepository.js";

const repo = createCollectionRepository(botDataFile("users.json"), { idPrefix: "USR" });

export function normalizeUser(row) {
  if (!row) return null;
  const discordId = String(row.discord_id || row.discordId || row.userId || row.id || "");
  return {
    ...row,
    id: row.id || discordId,
    userId: row.userId || discordId,
    discord_id: row.discord_id || discordId,
    discordId,
    username: row.username || row.globalName || row.displayName || "",
    avatar_url: row.avatar_url || row.avatarUrl || null,
    role: String(row.role || row.dashboardRole || row.staffRole || "").toLowerCase(),
    status: String(row.status || STAFF_STATUS.ACTIVE).toLowerCase(),
  };
}

export const userRepository = {
  async list() {
    return (await repo.list()).map(normalizeUser).filter(Boolean);
  },
  async findByDiscordId(discordId) {
    const safeId = String(discordId);
    return (await this.list()).find((row) => row.discordId === safeId) || null;
  },
  async upsertStaff(payload) {
    const discordId = String(payload.discordId || payload.discord_id || payload.userId || payload.id || "");
    const current = await this.findByDiscordId(discordId);
    if (current) {
      return normalizeUser(await repo.updateById(current.id, { ...payload, discordId, userId: discordId }));
    }
    return normalizeUser(await repo.create({ ...payload, discordId, discord_id: discordId, userId: discordId }));
  },
  async updateById(id, changes) {
    return normalizeUser(await repo.updateById(id, changes));
  },
};
