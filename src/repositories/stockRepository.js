function createStockRepository(database) {
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

  async function updateRows(fileKey, guildId, updater) {
    if (guildId && typeof database.updateScoped === "function") {
      return database.updateScoped(fileKey, guildId, [], updater);
    }
    if (typeof database.update === "function") {
      return database.update(fileKey, [], async (currentRaw) => {
        const currentRows = Array.isArray(currentRaw)
          ? currentRaw
          : currentRaw && typeof currentRaw === "object"
            ? Object.values(currentRaw).flat()
            : [];
        return updater(currentRows);
      });
    }
    const currentRows = await database.read(fileKey, []);
    const nextRows = await updater(currentRows);
    await database.write(fileKey, nextRows);
    return nextRows;
  }

  const stockCategories = {
    async getAll(guildId = null) {
      return readRows("stockCategories", guildId);
    },
    async findById(id) {
      const rows = await readRows("stockCategories");
      return rows.find((row) => row.id === id) || null;
    },
    async create(payload) {
      const rows = await readRows("stockCategories", payload.guildId);
      const now = new Date().toISOString();
      const row = {
        id: payload.id || `SC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        guildId: payload.guildId,
        key: payload.key || "",
        name: payload.name || "",
        type: payload.type || "digital_or_non_digital",
        description: payload.description || "",
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        lowStockThreshold: payload.lowStockThreshold || 0,
        createdAt: payload.createdAt || now,
        updatedAt: payload.updatedAt || now,
      };
      rows.push(row);
      await writeRows("stockCategories", rows, payload.guildId);
      return row;
    },
    async updateById(id, changes) {
      const allRows = await readRows("stockCategories");
      const existing = allRows.find((r) => r.id === id);
      if (!existing) return null;
      const guildId = existing.guildId;
      const rows = await readRows("stockCategories", guildId);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      const now = new Date().toISOString();
      rows[idx] = { ...rows[idx], ...changes, updatedAt: now };
      await writeRows("stockCategories", rows, guildId);
      return rows[idx];
    },
    async deleteById(id) {
      const allRows = await readRows("stockCategories");
      const existing = allRows.find((r) => r.id === id);
      if (!existing) return false;
      const guildId = existing.guildId;
      const rows = await readRows("stockCategories", guildId);
      const next = rows.filter((r) => r.id !== id);
      await writeRows("stockCategories", next, guildId);
      return next.length !== rows.length;
    },
  };

  const stockItems = {
    async getAll(guildId = null) {
      return readRows("stockItems", guildId);
    },
    async findById(id) {
      const rows = await readRows("stockItems");
      return rows.find((row) => row.id === id) || null;
    },
    async findBySku(guildId, sku) {
      const rows = await readRows("stockItems", guildId);
      return rows.find((row) => row.guildId === guildId && row.sku === sku) || null;
    },
    async create(payload) {
      const rows = await readRows("stockItems", payload.guildId);
      const now = new Date().toISOString();
      const row = {
        id: payload.id || `SI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        guildId: payload.guildId,
        categoryId: payload.categoryId || null,
        sku: payload.sku || "",
        name: payload.name || "",
        description: payload.description || "",
        deliveryType: payload.deliveryType || "manual",
        type: payload.type || "non_digital",
        price: payload.price || "",
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        lowStockThreshold: payload.lowStockThreshold || 0,
        createdAt: payload.createdAt || now,
        updatedAt: payload.updatedAt || now,
      };
      rows.push(row);
      await writeRows("stockItems", rows, payload.guildId);
      return row;
    },
    async updateById(id, changes) {
      const allRows = await readRows("stockItems");
      const existing = allRows.find((r) => r.id === id);
      if (!existing) return null;
      const guildId = existing.guildId;
      const rows = await readRows("stockItems", guildId);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      const now = new Date().toISOString();
      rows[idx] = { ...rows[idx], ...changes, updatedAt: now };
      await writeRows("stockItems", rows, guildId);
      return rows[idx];
    },
    async deleteById(id) {
      const allRows = await readRows("stockItems");
      const item = allRows.find((row) => row.id === id);
      if (!item) return false;
      const guildId = item.guildId;
      const rows = await readRows("stockItems", guildId);
      const next = rows.filter((r) => r.id !== id);
      await writeRows("stockItems", next, guildId);
      return next.length !== rows.length;
    },
  };

  const stockUnits = {
    async getAll(guildId = null) {
      return readRows("stockUnits", guildId);
    },
    async findById(id) {
      const rows = await readRows("stockUnits");
      return rows.find((row) => row.id === id) || null;
    },
    async findAvailableUnitsByItemId(guildId, itemId) {
      const rows = await readRows("stockUnits", guildId);
      return rows.filter((r) => r.guildId === guildId && r.itemId === itemId && r.status === "available");
    },
    async create(payload) {
      const rows = await readRows("stockUnits", payload.guildId);
      const now = new Date().toISOString();
      const row = {
        id: payload.id || `SU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        guildId: payload.guildId,
        itemId: payload.itemId,
        valueEncrypted: payload.valueEncrypted || null,
        skuSnapshot: payload.skuSnapshot || null,
        nameSnapshot: payload.nameSnapshot || null,
        status: payload.status || "available",
        reservedByOrderId: payload.reservedByOrderId || null,
        reservedAt: payload.reservedAt || null,
        soldToOrderId: payload.soldToOrderId || null,
        deliveredAt: payload.deliveredAt || null,
        addedBy: payload.addedBy || null,
        createdAt: payload.createdAt || now,
        updatedAt: payload.updatedAt || now,
      };
      rows.push(row);
      await writeRows("stockUnits", rows, payload.guildId);
      return row;
    },
    async updateById(id, changes) {
      const allRows = await readRows("stockUnits");
      const existing = allRows.find((r) => r.id === id);
      if (!existing) return null;
      const guildId = existing.guildId;
      const rows = await readRows("stockUnits", guildId);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      const now = new Date().toISOString();
      rows[idx] = { ...rows[idx], ...changes, updatedAt: now };
      await writeRows("stockUnits", rows, guildId);
      return rows[idx];
    },
    async deleteById(id) {
      const allRows = await readRows("stockUnits");
      const unit = allRows.find((row) => row.id === id);
      if (!unit) return false;
      const guildId = unit.guildId;
      const rows = await readRows("stockUnits", guildId);
      const next = rows.filter((r) => r.id !== id);
      await writeRows("stockUnits", next, guildId);
      return next.length !== rows.length;
    },
    async countAvailableByItemId(guildId, itemId) {
      const rows = await readRows("stockUnits", guildId);
      return rows.filter((r) => r.guildId === guildId && r.itemId === itemId && r.status === "available").length;
    },
  };

  async function ensureCategoryForKey(guildId, key) {
    const rows = await readRows("stockCategories", guildId);
    const existing = rows.find((r) => r.key === key);
    if (existing) return existing;

    return stockCategories.create({
      guildId,
      key,
      name: key,
      type: "digital_or_non_digital",
      description: "",
      isActive: true,
      lowStockThreshold: 0,
    });
  }

  return {
    stockCategories,
    stockItems,
    stockUnits,
    ensureCategoryForKey,
  };
}

module.exports = {
  createStockRepository,
};
