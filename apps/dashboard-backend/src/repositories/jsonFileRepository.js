import fs from "node:fs/promises";
import path from "node:path";

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function cloneFallback(fallback) {
  if (Array.isArray(fallback)) return [...fallback];
  if (fallback && typeof fallback === "object") return { ...fallback };
  return fallback;
}

export async function readJsonFile(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return cloneFallback(fallback);
  }
}

export async function writeJsonFile(filePath, data) {
  await ensureParent(filePath);
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
  return data;
}

export function createCollectionRepository(filePath, { fallback = [], idPrefix = "ROW" } = {}) {
  async function list() {
    const rows = await readJsonFile(filePath, fallback);
    return Array.isArray(rows) ? rows : [];
  }

  async function replaceAll(rows) {
    return writeJsonFile(filePath, Array.isArray(rows) ? rows : []);
  }

  function getRowId(row) {
    return row?.id || row?.order_code || row?.orderCode || row?.invoice_code || row?.invoiceCode || row?.discord_id || row?.discordId || row?.userId;
  }

  return {
    list,
    replaceAll,
    async findById(id) {
      const safeId = String(id);
      return (await list()).find((row) => String(getRowId(row)) === safeId) || null;
    },
    async create(payload) {
      const rows = await list();
      const row = {
        id: payload.id || `${idPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...payload,
        created_at: payload.created_at || payload.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      rows.push(row);
      await replaceAll(rows);
      return row;
    },
    async updateById(id, changes) {
      const rows = await list();
      const safeId = String(id);
      const index = rows.findIndex((row) => String(getRowId(row)) === safeId);
      if (index < 0) return null;
      rows[index] = {
        ...rows[index],
        ...changes,
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await replaceAll(rows);
      return rows[index];
    },
    async deleteById(id) {
      const rows = await list();
      const safeId = String(id);
      const nextRows = rows.filter((row) => String(getRowId(row)) !== safeId);
      await replaceAll(nextRows);
      return nextRows.length !== rows.length;
    },
  };
}
