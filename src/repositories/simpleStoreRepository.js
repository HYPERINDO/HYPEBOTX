function createSimpleStoreRepository(database) {
  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async function readRows(fileKey, guildId = null) {
    if (guildId && typeof database.readScoped === "function") {
      return database.readScoped(fileKey, guildId, []);
    }
    if (typeof database.readAll === "function") {
      return database.readAll(fileKey, []);
    }
    return database.read(fileKey, []);
  }

  async function writeRows(fileKey, rows, guildId = null) {
    if (guildId && typeof database.writeScoped === "function") {
      return database.writeScoped(fileKey, guildId, rows, []);
    }
    return database.write(fileKey, rows);
  }

  function listRepository(fileKey, prefix) {
    return {
      async getAll(guildId = null) {
        return readRows(fileKey, guildId);
      },
      async findById(id, guildId = null) {
        const rows = await readRows(fileKey, guildId);
        return rows.find((row) => row.id === id) || null;
      },
      async create(payload) {
        const rows = await readRows(fileKey, payload.guildId);
        const row = {
          id: payload.id || uid(prefix),
          ...payload,
          createdAt: payload.createdAt || new Date().toISOString(),
          updatedAt: payload.updatedAt || new Date().toISOString(),
        };
        rows.push(row);
        await writeRows(fileKey, rows, payload.guildId);
        return row;
      },
      async updateById(id, changes) {
        const allRows = await readRows(fileKey);
        const existing = allRows.find((row) => row.id === id);
        if (!existing) return null;
        const guildId = existing.guildId;
        const rows = await readRows(fileKey, guildId);
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0) return null;
        rows[index] = { ...rows[index], ...changes, updatedAt: new Date().toISOString() };
        await writeRows(fileKey, rows, guildId);
        return rows[index];
      },
      async deleteById(id) {
        const allRows = await readRows(fileKey);
        const item = allRows.find((row) => row.id === id);
        if (!item) return false;
        const guildId = item.guildId;
        const rows = await readRows(fileKey, guildId);
        const nextRows = rows.filter((row) => row.id !== id);
        await writeRows(fileKey, nextRows, guildId);
        return nextRows.length !== rows.length;
      },
    };
  }

  return {
    faqs: listRepository("faqs", "FAQ"),
    adminNotes: listRepository("adminNotes", "NOTE"),
    blacklist: listRepository("blacklist", "BL"),
    staffLogs: listRepository("staffLogs", "LOG"),
    priceList: listRepository("priceList", "PRICE"),
    async getSettings() {
      return database.read("storeSettings", {});
    },
    async updateSettings(changes) {
      const current = await database.read("storeSettings", {});
      const next = { ...current, ...changes, updatedAt: new Date().toISOString() };
      await database.write("storeSettings", next);
      return next;
    },
    async getNextOrderId(guildId) {
      const key = `orderCounter_${guildId}`;
      if (typeof database.update === "function") {
        let next = 0;
        await database.update("counters", {}, async (currentCounters) => {
          const counters = currentCounters && typeof currentCounters === "object" ? { ...currentCounters } : {};
          const current = Number.parseInt(String(counters[key] ?? 0), 10);
          next = Number.isFinite(current) ? current + 1 : 1;
          counters[key] = next;
          return counters;
        });
        return `HYP-${String(next).padStart(4, "0")}`;
      }

      const counters = await database.read("counters", {});
      const current = Number.parseInt(String(counters[key] ?? 0), 10);
      const next = Number.isFinite(current) ? current + 1 : 1;
      await database.write("counters", { ...counters, [key]: next });
      return `HYP-${String(next).padStart(4, "0")}`;
    },
  };
}

module.exports = {
  createSimpleStoreRepository,
};
