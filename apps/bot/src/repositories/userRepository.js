const { createUser } = require("../database/models/User");

function createUserRepository(database) {
  async function readRows(guildId = null) {
    if (guildId && typeof database.readScoped === "function") {
      return database.readScoped("users", guildId, []);
    }
    if (typeof database.readAll === "function") {
      return database.readAll("users", []);
    }
    return database.read("users", []);
  }

  async function updateScopedUsers(guildId, updater) {
    if (typeof database.updateScoped === "function") {
      return database.updateScoped("users", guildId, [], updater);
    }

    const rows = await database.read("users", []);
    const preserved = Array.isArray(rows) ? rows.filter((row) => row && row.guildId !== guildId) : [];
    const scoped = Array.isArray(rows) ? rows.filter((row) => row && row.guildId === guildId) : [];
    const nextScoped = await updater(scoped);
    const next = Array.isArray(nextScoped) ? [...preserved, ...nextScoped] : [...preserved, nextScoped];
    await database.write("users", next);
    return nextScoped;
  }

  return {
    async getAll() {
      return readRows();
    },
    async find(guildId, userId) {
      const rows = await readRows(guildId);
      return rows.find((row) => row.guildId === guildId && row.userId === userId) || null;
    },
    async upsert(payload) {
      let updated = null;
      await updateScopedUsers(payload.guildId, (currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const index = rows.findIndex((row) => row.guildId === payload.guildId && row.userId === payload.userId);
        if (index < 0) {
          const user = createUser(payload);
          rows.push(user);
          updated = user;
          return rows;
        }

        rows[index] = {
          ...rows[index],
          ...payload,
          updatedAt: new Date().toISOString(),
        };
        updated = rows[index];
        return rows;
      });
      return updated;
    },
    async incrementOrder(guildId, userId, username = "") {
      const existing = await this.find(guildId, userId);
      const newTotal = Number(existing?.totalOrder || 0) + 1;

      let newTier = existing?.tier || "new";
      if (newTotal >= 20) newTier = "vip";
      else if (newTotal >= 10) newTier = "gold";
      else if (newTotal >= 5) newTier = "silver";

      return this.upsert({
        guildId,
        userId,
        username: username || existing?.username || "",
        roles: existing?.roles || [],
        status: existing?.status || "normal",
        tier: newTier,
        blacklistReason: existing?.blacklistReason || "",
        totalOrder: newTotal,
        lastOrderAt: new Date().toISOString(),
      });
    },
    async incrementWarranty(guildId, userId, username = "") {
      const existing = await this.find(guildId, userId);
      return this.upsert({
        guildId,
        userId,
        username: username || existing?.username || "",
        warrantyCount: Number(existing?.warrantyCount || 0) + 1,
      });
    },
    async incrementDispute(guildId, userId, username = "") {
      const existing = await this.find(guildId, userId);
      return this.upsert({
        guildId,
        userId,
        username: username || existing?.username || "",
        disputeCount: Number(existing?.disputeCount || 0) + 1,
      });
    },
    async incrementRefund(guildId, userId, username = "") {
      const existing = await this.find(guildId, userId);
      return this.upsert({
        guildId,
        userId,
        username: username || existing?.username || "",
        refundCount: Number(existing?.refundCount || 0) + 1,
      });
    },
    async setTier(guildId, userId, tier) {
      const existing = await this.find(guildId, userId);
      return this.upsert({
        guildId,
        userId,
        username: existing?.username || "",
        tier,
      });
    },
    async getTopCustomers(guildId, limit = 10) {
      const rows = await readRows(guildId);
      return rows
        .filter((row) => row.status !== "blacklist")
        .sort((a, b) => (b.totalOrder || 0) - (a.totalOrder || 0))
        .slice(0, limit);
    },
    async findByStatus(guildId, status) {
      const rows = await readRows(guildId);
      return rows.filter((row) => row.status === status);
    },
  };
}

module.exports = {
  createUserRepository,
};
