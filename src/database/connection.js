const fs = require("fs");
const path = require("path");

const { runMigration } = require("./migrations/init");

function ensureDir(target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
}

function createDatabase(paths, logger) {
  const storageRoot = paths?.storage?.root || path.join(process.cwd(), "src", "storage");
  const storageBackups = paths?.storage?.backups || path.join(storageRoot, "backups");
  const storageTranscripts = paths?.storage?.transcripts || path.join(storageRoot, "transcripts");
  const storageTemp = paths?.storage?.temp || path.join(storageRoot, "temp");

  const files = {
    guildConfigs: path.join(storageTemp, "guild-configs.json"),
    tickets: path.join(storageTemp, "tickets.json"),
    orders: path.join(storageTemp, "orders.json"),
    payments: path.join(storageTemp, "payments.json"),
    roleConfigs: path.join(storageTemp, "role-configs.json"),
    backups: path.join(storageTemp, "backups.json"),
    giveaways: path.join(storageTemp, "giveaways.json"),
    afk: path.join(storageTemp, "afk.json"),
    leaderboard: path.join(storageTemp, "leaderboard.json"),
    users: path.join(storageTemp, "users.json"),
    faqs: path.join(storageTemp, "faqs.json"),
    adminNotes: path.join(storageTemp, "admin-notes.json"),
    blacklist: path.join(storageTemp, "blacklist.json"),
    staffLogs: path.join(storageTemp, "staff-logs.json"),
    priceList: path.join(storageTemp, "price-list.json"),
    storeSettings: path.join(storageTemp, "store-settings.json"),
    counters: path.join(storageTemp, "counters.json"),
    // Joki system
    jokiQueues: path.join(storageTemp, "joki-queues.json"),

    // Stock management (Sprint 2)
    stockCategories: path.join(storageTemp, "stock-categories.json"),
    stockItems: path.join(storageTemp, "stock-items.json"),
    stockUnits: path.join(storageTemp, "stock-units.json"),

    // Refund / Dispute (Priority 1)
    refundDisputes: path.join(storageTemp, "refund-disputes.json"),

    // Backlog operations
    coupons: path.join(storageTemp, "coupons.json"),
    testimonials: path.join(storageTemp, "testimonials.json"),
    jokiShifts: path.join(storageTemp, "joki-shifts.json"),
    jokiCommissions: path.join(storageTemp, "joki-commissions.json"),
    mutations: path.join(storageTemp, "mutations.json"),
    termsAcceptances: path.join(storageTemp, "terms-acceptances.json"),
    sensitiveWarnings: path.join(storageTemp, "sensitive-warnings.json"),
    aiLogs: path.join(storageTemp, "ai-logs.json"),
  };

  // File locking mechanism to prevent concurrent writes
  const writeLocks = new Map();

  function normalizeFileKey(fileKey) {
    if (typeof fileKey === "string") {
      return fileKey.trim();
    }
    if (fileKey === null || fileKey === undefined) {
      return "";
    }
    return String(fileKey).trim();
  }

  function resolveFileBinding(fileKey) {
    const normalizedKey = normalizeFileKey(fileKey);
    if (!normalizedKey) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(files, normalizedKey)) {
      return { type: "direct", filePath: files[normalizedKey], counterKey: null, normalizedKey };
    }

    // Backward compatibility:
    // Older runtime code may write/read using fileKey = "orderCounter_<guildId>" directly.
    if (normalizedKey.toLowerCase().startsWith("ordercounter_")) {
      return { type: "counterEntry", filePath: files.counters, counterKey: normalizedKey, normalizedKey };
    }

    return null;
  }

  function resolveLockKey(fileKey) {
    const binding = resolveFileBinding(fileKey);
    return binding?.filePath || normalizeFileKey(fileKey) || String(fileKey);
  }

  function acquireLock(fileKey) {
    return new Promise((resolve) => {
      if (writeLocks.has(fileKey)) {
        writeLocks.get(fileKey).push(resolve);
      } else {
        writeLocks.set(fileKey, []);
        resolve();
      }
    });
  }

  function releaseLock(fileKey) {
    const queue = writeLocks.get(fileKey);
    if (queue && queue.length > 0) {
      const nextResolve = queue.shift();
      nextResolve();
    } else {
      writeLocks.delete(fileKey);
    }
  }

  function init() {
    ensureDir(storageRoot);
    ensureDir(storageBackups);
    ensureDir(storageTranscripts);
    ensureDir(storageTemp);
    runMigration(files, logger);
    logger.info("database initialized");
  }

  async function readUnsafe(fileKey, fallback = []) {
    const binding = resolveFileBinding(fileKey);
    if (!binding?.filePath) {
      logger.warn("database file key not mapped", {
        fileKey,
        normalizedFileKey: normalizeFileKey(fileKey),
      });
      return fallback;
    }

    try {
      const raw = await fs.promises.readFile(binding.filePath, "utf8");
      const parsed = JSON.parse(raw);

      if (binding.type === "counterEntry") {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return fallback;
        }
        return parsed[binding.counterKey] ?? fallback;
      }

      return parsed;
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.warn("database read error", {
          fileKey,
          normalizedFileKey: binding.normalizedKey || normalizeFileKey(fileKey),
          filePath: binding.filePath,
          message: error?.message,
          code: error?.code,
          path: error?.path,
        });
      }
      return fallback;
    }
  }

  async function writeUnsafe(fileKey, data) {
    const binding = resolveFileBinding(fileKey);
    const target = binding?.filePath;
    const tmp = target ? `${target}.tmp` : null;
    try {
      if (!target) {
        throw new Error(`Unknown database fileKey: ${fileKey}`);
      }

      const backup = `${target}.bak`;
      let nextPayload = data;

      if (binding.type === "counterEntry") {
        const currentCounters = await readUnsafe("counters", {});
        const counters =
          currentCounters && typeof currentCounters === "object" && !Array.isArray(currentCounters)
            ? { ...currentCounters }
            : {};
        counters[binding.counterKey] = data;
        nextPayload = counters;
      }

      const payload = JSON.stringify(nextPayload, null, 2);

      // Atomic write strategy:
      // 1) write tmp
      // 2) keep one backup of previous file
      // 3) rename tmp -> target
      await fs.promises.writeFile(tmp, payload, "utf8");

      if (fs.existsSync(target)) {
        try {
          await fs.promises.copyFile(target, backup);
        } catch (copyError) {
          logger.warn("database backup copy failed", { fileKey, filePath: target, error: copyError.message });
        }
      }

      await fs.promises.rename(tmp, target);
      return data;
    } catch (error) {
      try {
        if (tmp && fs.existsSync(tmp)) {
          await fs.promises.unlink(tmp);
        }
      } catch (_) {
        // ignore cleanup error
      }
      logger.error("database write error", {
        fileKey,
        normalizedFileKey: binding?.normalizedKey || normalizeFileKey(fileKey),
        filePath: target,
        tmpPath: tmp,
        message: error?.message,
        code: error?.code,
        path: error?.path,
        stack: error?.stack,
      });
      throw error;
    }
  }

  async function read(fileKey, fallback = []) {
    return readUnsafe(fileKey, fallback);
  }

  async function write(fileKey, data) {
    const lockKey = resolveLockKey(fileKey);
    await acquireLock(lockKey);
    try {
      return await writeUnsafe(fileKey, data);
    } finally {
      releaseLock(lockKey);
    }
  }

  async function update(fileKey, fallback = [], updater = (current) => current) {
    const lockKey = resolveLockKey(fileKey);
    await acquireLock(lockKey);
    try {
      const current = await readUnsafe(fileKey, fallback);
      const next = await updater(current);
      await writeUnsafe(fileKey, next);
      return next;
    } finally {
      releaseLock(lockKey);
    }
  }

  async function readScoped(fileKey, guildId, fallback = []) {
    const raw = await readUnsafe(fileKey, Array.isArray(fallback) ? fallback : {});
    if (Array.isArray(raw)) {
      return raw.filter((record) => record && record.guildId === guildId);
    }
    if (raw && typeof raw === "object") {
      return raw[guildId] ?? fallback;
    }
    return fallback;
  }

  async function readAll(fileKey, fallback = []) {
    const raw = await readUnsafe(fileKey, Array.isArray(fallback) ? fallback : {});
    if (Array.isArray(raw)) {
      return raw;
    }
    if (raw && typeof raw === "object") {
      return Object.values(raw).flat();
    }
    return fallback;
  }

  async function writeScoped(fileKey, guildId, data, fallback = []) {
    const current = await readUnsafe(fileKey, Array.isArray(fallback) ? fallback : {});
    if (Array.isArray(current)) {
      const preserved = current.filter((record) => record && record.guildId !== guildId);
      const scopedRows = Array.isArray(data) ? data : [data];
      return writeUnsafe(fileKey, [...preserved, ...scopedRows]);
    }
    if (current && typeof current === "object") {
      return writeUnsafe(fileKey, { ...current, [guildId]: data });
    }
    return writeUnsafe(fileKey, { [guildId]: data });
  }

  async function updateScoped(fileKey, guildId, fallback = [], updater = (current) => current) {
    await acquireLock(fileKey);
    try {
      const current = await readUnsafe(fileKey, Array.isArray(fallback) ? fallback : {});
      if (Array.isArray(current)) {
        const preserved = current.filter((record) => record && record.guildId !== guildId);
        const currentScoped = current.filter((record) => record && record.guildId === guildId);
        const nextScoped = await updater(currentScoped);
        const rows = Array.isArray(nextScoped) ? [...preserved, ...nextScoped] : [...preserved, nextScoped];
        await writeUnsafe(fileKey, rows);
        return nextScoped;
      }

      const currentScoped = current && typeof current === "object" ? current[guildId] ?? fallback : fallback;
      const nextScoped = await updater(currentScoped);
      const next = { ...(current && typeof current === "object" ? current : {}), [guildId]: nextScoped };
      await writeUnsafe(fileKey, next);
      return nextScoped;
    } finally {
      releaseLock(fileKey);
    }
  }

  async function saveBackupFile(fileName, payload) {
    try {
      const fullPath = path.join(storageBackups, fileName);
      await fs.promises.writeFile(fullPath, JSON.stringify(payload, null, 2), "utf8");
      return fullPath;
    } catch (error) {
      logger.error("backup save error", { fileName, error: error.message });
      throw error;
    }
  }

  async function readBackupFile(fileName) {
    try {
      const fullPath = path.join(storageBackups, fileName);
      const raw = await fs.promises.readFile(fullPath, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      logger.error("backup read error", { fileName, error: error.message });
      throw error;
    }
  }

  async function listBackupFiles() {
    try {
      const entries = await fs.promises.readdir(storageBackups, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
        .sort()
        .reverse();
    } catch (error) {
      logger.error("backup list error", { error: error.message });
      return [];
    }
  }

  async function saveTranscript(fileName, content) {
    try {
      const fullPath = path.join(storageTranscripts, fileName);
      await fs.promises.writeFile(fullPath, content, "utf8");
      return fullPath;
    } catch (error) {
      logger.error("transcript save error", { fileName, error: error.message });
      throw error;
    }
  }

  return {
    files,
    init,
    read,
    write,
    update,
    readAll,
    readScoped,
    writeScoped,
    updateScoped,
    saveBackupFile,
    readBackupFile,
    listBackupFiles,
    saveTranscript,
  };
}

module.exports = {
  createDatabase,
};
