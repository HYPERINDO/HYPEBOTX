const path = require("path");
const dotenv = require("dotenv");

const rootPath = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.join(rootPath, ".env") });

const dataDir = process.env.DATA_DIR || process.env.DATABASE_DIR || "./src/storage";
const storagePath = path.isAbsolute(dataDir) ? dataDir : path.join(rootPath, dataDir);

module.exports = {
  token: process.env.DISCORD_TOKEN || "",
  clientId: process.env.CLIENT_ID || "",
  guildId: process.env.GUILD_ID || "",
  allowedGuildIds: (process.env.ALLOWED_GUILD_IDS || "").split(",").map(id => id.trim()).filter(Boolean),
  storeName: process.env.STORE_NAME || "GameStore",
  defaultCurrency: process.env.DEFAULT_CURRENCY || "IDR",
  logging: {
    webhookUrl:
      process.env.ERROR_WEBHOOK_URL ||
      process.env.DISCORD_LOG_WEBHOOK_URL ||
      process.env.BOT_LOG_WEBHOOK_URL ||
      process.env.MUSIC_DEBUG_WEBHOOK_URL ||
      "",
    webhookLevels: (process.env.DISCORD_LOG_WEBHOOK_LEVELS || "ERROR,WARN")
      .split(",")
      .map((level) => level.trim().toUpperCase())
      .filter(Boolean),
  },
  payment: {
    // Metode yang diterima (sesuai kebutuhan customer):
    // - BCA
    // - BRI
    // - DANA
    // - SHOPEEPAY
    bank:
      process.env.PAYMENT_BANK ||
      "BCA - 5358047992 a.n. ALVIAN DIKY PUTRA UTOMO | BRI - 040801040543505 a.n. ALVIAN DIKY PUTRA UTOMO",
    ewallet:
      process.env.PAYMENT_EWALLET ||
      "DANA - 089531277179 a/n ALVIAN DIKY PUTRA UTOMO | SHOPEEPAY - 089531277179 a/n ALVIAN DIKY PUTRA UTOMO",
    // QRIS tidak diterima pada setting saat ini
    qris: process.env.PAYMENT_QRIS || "-",
  },
  moderation: {
    floodWindowMs: 8000,
    floodMessageCount: 6,
    massMentionThreshold: 5,
    timeoutMinutes: 10,
  },
  jobs: {
    autoBackupMs: 6 * 60 * 60 * 1000,
    ticketSweepMs: 10 * 60 * 1000,
    ticketAutoCloseHours: 72,
    ticketInactiveWarningHours: Number(process.env.TICKET_INACTIVE_WARNING_HOURS || 72),
    ticketInactiveCloseGraceHours: Number(process.env.TICKET_INACTIVE_CLOSE_GRACE_HOURS || 24),
    ticketPendingPaymentGraceHours: Number(process.env.TICKET_PENDING_PAYMENT_GRACE_HOURS || 6),
    jokiSweepMs: Number(process.env.JOKI_SWEEP_MS || 60 * 1000),
    jokiHoldReminderSweepMs: Number(process.env.JOKI_HOLD_REMINDER_SWEEP_MS || 60 * 1000),
    jokiHoldReminderThresholdMs: Number(process.env.JOKI_HOLD_REMINDER_THRESHOLD_MS || 60 * 60 * 1000),
    jokiHoldReminderCooldownMs: Number(process.env.JOKI_HOLD_REMINDER_COOLDOWN_MS || 45 * 60 * 1000),
    jokiHoldReminderMaxAlertsPerSweep: Number(process.env.JOKI_HOLD_REMINDER_MAX_ALERTS || 25),
    paymentReminderSweepMs: Number(process.env.PAYMENT_REMINDER_SWEEP_MS || 5 * 60 * 1000),
    paymentReminderThresholdMinutes: Number(process.env.PAYMENT_REMINDER_THRESHOLD_MINUTES || 30),
    paymentReminderCooldownMinutes: Number(process.env.PAYMENT_REMINDER_COOLDOWN_MINUTES || 45),
    paymentReminderMaxAlertsPerSweep: Number(process.env.PAYMENT_REMINDER_MAX_ALERTS || 50),
    giveawaySweepMs: 15 * 1000,
    musicCleanupMs: 60 * 1000,
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    ttl: {
      userCache: 300, // 5 minutes
      guildCache: 600, // 10 minutes
      commandCache: 1800, // 30 minutes
    }
  },
  database: {
    type: process.env.DB_TYPE || process.env.STORAGE_DRIVER || process.env.DATABASE_PROVIDER || "sqlite", // sqlite, postgres, or json
    sqlite: {
      path: path.join(storagePath, "database.db")
    },
    postgres: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || "hypebotx",
      username: process.env.DB_USER || "hypebotx",
      password: process.env.DB_PASSWORD || "",
      ssl: process.env.DB_SSL === "true"
    }
  },
  queue: {
    redis: {
      host: process.env.QUEUE_REDIS_HOST || process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.QUEUE_REDIS_PORT) || parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.QUEUE_REDIS_PASSWORD || process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY) || 5,
    attempts: parseInt(process.env.QUEUE_ATTEMPTS) || 3,
  },
  rateLimit: {
    global: {
      windowMs: 1000, // 1 second
      max: 10, // 10 requests per window
    },
    command: {
      windowMs: 5000, // 5 seconds
      max: 5, // 5 commands per window
    },
    ai: {
      windowMs: 60000, // 1 minute
      max: 3, // 3 AI requests per minute per user
    }
  },
  monitoring: {
    port: parseInt(process.env.MONITORING_PORT) || 3001,
    enabled: process.env.MONITORING_ENABLED === "true",
  },
  music: {
    defaultVolume: parseFloat(process.env.MUSIC_DEFAULT_VOLUME) || 0.8,
    enabled: process.env.MUSIC_ENABLED !== "false",
  },
  paths: {
    root: rootPath,
    docs: path.join(rootPath, "docs"),
    storage: {
      root: storagePath,
      backups: path.join(storagePath, "backups"),
      transcripts: path.join(storagePath, "transcripts"),
      temp: path.join(storagePath, "temp"),
    },
  },
};
