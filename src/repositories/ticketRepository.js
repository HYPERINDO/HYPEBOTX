function parseTicketNumericId(value) {
  const raw = String(value || "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nextTicketIdFromRows(rows) {
  let max = 0;
  for (const row of rows) {
    const numeric = parseTicketNumericId(row?.id);
    if (numeric && numeric > max) {
      max = numeric;
    }
  }
  return String(max + 1).padStart(4, "0");
}

function createTicketRepository(database) {
  async function updateTickets(mutator) {
    if (typeof database.update === "function") {
      return database.update("tickets", [], mutator);
    }

    const currentRows = await database.read("tickets", []);
    const nextRows = await mutator(currentRows);
    await database.write("tickets", nextRows);
    return nextRows;
  }

  async function updateCounters(mutator) {
    if (typeof database.update === "function") {
      return database.update("counters", {}, mutator);
    }

    const currentCounters = await database.read("counters", {});
    const nextCounters = await mutator(currentCounters);
    await database.write("counters", nextCounters);
    return nextCounters;
  }

  return {
    async getAll() {
      return database.read("tickets", []);
    },
    async getAllByGuildId(guildId) {
      if (typeof database.readScoped === "function") {
        return database.readScoped("tickets", guildId, []);
      }
      const rows = await database.read("tickets", []);
      return rows.filter((row) => row.guildId === guildId);
    },
    async allocateNextId() {
      let nextId = "0001";
      await updateCounters(async (currentCounters) => {
        const counters = currentCounters && typeof currentCounters === "object"
          ? { ...currentCounters }
          : {};

        let currentValue = Number.parseInt(String(counters.ticket || ""), 10);
        if (!Number.isFinite(currentValue) || currentValue < 0) {
          const rows = await database.read("tickets", []);
          const computed = nextTicketIdFromRows(rows);
          currentValue = Math.max(0, Number.parseInt(computed, 10) - 1);
        }

        currentValue += 1;
        counters.ticket = currentValue;
        nextId = String(currentValue).padStart(4, "0");
        return counters;
      });
      return nextId;
    },
    async create(ticket) {
      let created = null;
      await updateTickets((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const record = { ...ticket };

        if (!record.id) {
          record.id = nextTicketIdFromRows(rows);
        }

        if (rows.some((row) => row.id === record.id)) {
          throw new Error(`Duplicate ticket ID: ${record.id}`);
        }

        rows.push(record);
        created = record;
        return rows;
      });
      return created;
    },
    async update(id, changes) {
      let updated = null;
      await updateTickets((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0) {
          return rows;
        }

        rows[index] = { ...rows[index], ...changes };
        updated = rows[index];
        return rows;
      });
      return updated;
    },
    async findByChannelId(channelId) {
      const rows = await database.read("tickets", []);
      return rows.find((row) => row.channelId === channelId) || null;
    },
    async findById(id) {
      const rows = await database.read("tickets", []);
      return rows.find((row) => row.id === id) || null;
    },
    async findOpenByUser(guildId, openerId, type) {
      const rows = await this.getAllByGuildId(guildId);
      return (
        rows.find(
          (row) =>
            row.openerId === openerId &&
            row.type === type &&
            row.status === "open",
        ) || null
      );
    },
  };
}

module.exports = {
  createTicketRepository,
};
