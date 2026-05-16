const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const preferredEnvFile = process.env.ENV_FILE || ".env.local";
const preferredEnvPath = path.join(__dirname, preferredEnvFile);
const fallbackEnvPath = path.join(__dirname, ".env");
const resolvedEnvPath = fs.existsSync(preferredEnvPath) ? preferredEnvPath : fallbackEnvPath;

dotenv.config({ path: resolvedEnvPath });

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const maxOldSpaceSizeMb = parsePositiveInt(
  process.env.NODE_MAX_OLD_SPACE_SIZE_MB,
  512
);

const pm2MaxMemoryRestart = process.env.PM2_MAX_MEMORY_RESTART || "700M";

module.exports = {
  apps: [
    {
      name: "hypebotx",
      script: "src/index.js",

      instances: parsePositiveInt(process.env.PM2_INSTANCES, 1),
      exec_mode: "fork",

      autorestart: true,
      watch: false,

      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 5000,

      max_memory_restart: pm2MaxMemoryRestart,

      node_args: [
        `--max-old-space-size=${maxOldSpaceSizeMb}`,
        "--expose-gc",
      ],

      env: {
        ...process.env,
        ENV_FILE: fs.existsSync(preferredEnvPath) ? preferredEnvFile : ".env",

        NODE_ENV: process.env.NODE_ENV || "production",

        DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || "json",
        STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || "json",
        DATABASE_DIR: process.env.DATABASE_DIR || "./src/storage",
        BACKUP_DIR: process.env.BACKUP_DIR || "./src/storage/backups",
        TEMP_DIR: process.env.TEMP_DIR || "./src/storage/temp",
        TRANSCRIPT_DIR:
          process.env.TRANSCRIPT_DIR || "./src/storage/transcripts",

        CACHE_PROVIDER: process.env.CACHE_PROVIDER || "memory",
        REDIS_ENABLED: process.env.REDIS_ENABLED || "false",
        REDIS_URL: process.env.REDIS_URL || "",
        BULL_ENABLED: process.env.BULL_ENABLED || "false",
        DATA_DIR: process.env.DATA_DIR || process.env.DATABASE_DIR || "./data",
        DATABASE_DIR: process.env.DATABASE_DIR || process.env.DATA_DIR || "./data",
        STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || process.env.DATABASE_PROVIDER || "json",
      },

      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      merge_logs: true,
    },
  ],
};
