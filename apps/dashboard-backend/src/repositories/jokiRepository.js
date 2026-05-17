import { botDataFile } from "../config/database.js";
import { readJsonFile, writeJsonFile } from "./jsonFileRepository.js";

const filePath = botDataFile("joki-queues.json");

function normalizeStore(raw) {
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.filter((queue) => queue?.guildId).map((queue) => [queue.guildId, queue]));
  }
  if (raw && typeof raw === "object") return raw;
  return {};
}

async function readStore() {
  return normalizeStore(await readJsonFile(filePath, {}));
}

async function writeStore(store) {
  return writeJsonFile(filePath, store);
}

function flatten(store) {
  return Object.entries(store).flatMap(([guildId, queue]) =>
    [...(queue?.orders || []), ...(queue?.history || [])].map((job) => ({ ...job, guildId })),
  );
}

export const jokiRepository = {
  async listQueues() {
    return Object.values(await readStore());
  },
  async listJobs() {
    return flatten(await readStore());
  },
  async findJob(id) {
    return (await this.listJobs()).find((job) => String(job.id) === String(id)) || null;
  },
  async updateJob(id, changes) {
    const store = await readStore();
    let updated = null;
    for (const queue of Object.values(store)) {
      const index = (queue.orders || []).findIndex((job) => String(job.id) === String(id));
      if (index >= 0) {
        queue.orders[index] = { ...queue.orders[index], ...changes, updatedAt: new Date().toISOString() };
        updated = queue.orders[index];
        break;
      }
    }
    if (updated) await writeStore(store);
    return updated;
  },
};
