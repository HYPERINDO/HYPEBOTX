const { createGuildConfig } = require("../database/models/GuildConfig");

function createGuildRepository(database) {
  return {
    async getByGuildId(guildId) {
      const rows = await database.read("guildConfigs", []);
      return rows.find((row) => row.guildId === guildId) || null;
    },
    async upsert(guildId, changes = {}) {
      const rows = await database.read("guildConfigs", []);
      const index = rows.findIndex((row) => row.guildId === guildId);
      const next = index >= 0 ? { ...rows[index], ...changes, updatedAt: new Date().toISOString() } : { ...createGuildConfig(guildId), ...changes };

      if (index >= 0) {
        rows[index] = next;
      } else {
        rows.push(next);
      }

      await database.write("guildConfigs", rows);
      return next;
    },
  };
}

module.exports = {
  createGuildRepository,
};
