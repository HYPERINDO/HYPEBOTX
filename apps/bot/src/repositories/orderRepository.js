function createOrderRepository(database) {
  async function updateOrders(mutator) {
    if (typeof database.update === "function") {
      return database.update("orders", [], mutator);
    }

    const currentRows = await database.read("orders", []);
    const nextRows = await mutator(currentRows);
    await database.write("orders", nextRows);
    return nextRows;
  }

  return {
    async getAll() {
      return database.read("orders", []);
    },
    async getAllByGuildId(guildId) {
      if (typeof database.readScoped === "function") {
        return database.readScoped("orders", guildId, []);
      }
      const rows = await database.read("orders", []);
      return rows.filter((row) => row.guildId === guildId);
    },
    async findById(id) {
      const rows = await database.read("orders", []);
      return rows.find((row) => row.id === id) || null;
    },

    // Guild-scoped lookup to prevent cross-guild update by orderId collision
    async findByIdScoped(guildId, id) {
      const rows = await database.read("orders", []);
      return (
        rows.find((row) => row.guildId === guildId && row.id === id) || null
      );
    },
    async findByUserId(guildId, userId) {
      const rows = await database.read("orders", []);
      return rows.filter((row) => row.guildId === guildId && row.userId === userId);
    },
    async create(order) {
      let created = null;
      await updateOrders((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        if (rows.some((row) => row.id === order.id)) {
          throw new Error(`Duplicate order ID: ${order.id}`);
        }
        created = { ...order };
        rows.push(created);
        return rows;
      });
      return created;
    },
    async updateById(id, changes) {
      let updated = null;
      await updateOrders((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0) {
          return rows;
        }

        rows[index] = {
          ...rows[index],
          ...changes,
          updatedAt: new Date().toISOString(),
        };
        updated = rows[index];
        return rows;
      });
      return updated;
    },

    // Guild-scoped update to prevent cross-guild update by orderId collision
    async updateByIdScoped(guildId, id, changes) {
      let updated = null;
      await updateOrders((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const index = rows.findIndex((row) => row.guildId === guildId && row.id === id);
        if (index < 0) {
          return rows;
        }

        rows[index] = {
          ...rows[index],
          ...changes,
          updatedAt: new Date().toISOString(),
        };
        updated = rows[index];
        return rows;
      });
      return updated;
    },
    async updateByTicketId(ticketId, changes) {
      let updated = null;
      await updateOrders((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const index = rows.findIndex((row) => row.ticketId === ticketId);
        if (index < 0) {
          return rows;
        }

        rows[index] = {
          ...rows[index],
          ...changes,
          updatedAt: new Date().toISOString(),
        };
        updated = rows[index];
        return rows;
      });
      return updated;
    },
    async findByTicketId(ticketId) {
      const rows = await database.read("orders", []);
      return rows.find((row) => row.ticketId === ticketId) || null;
    },
  };
}

module.exports = {
  createOrderRepository,
};
