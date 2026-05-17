const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..", "..");
const preferredEnvFile = process.env.ENV_FILE || ".env.local";
const envCandidates = [
  path.join(repoRoot, preferredEnvFile),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, ".env"),
  path.join(repoRoot, "apps", "bot", preferredEnvFile),
  path.join(repoRoot, "apps", "bot", ".env"),
];
const resolvedEnvPath = envCandidates.find((candidate) => fs.existsSync(candidate));

if (resolvedEnvPath) {
  dotenv.config({ path: resolvedEnvPath, override: true });
}

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
      name: "hypebotx-bot",
      cwd: path.join(repoRoot, "apps", "bot"),
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
        ENV_FILE: preferredEnvFile,

        NODE_ENV: process.env.NODE_ENV || "production",

        DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || "json",
        STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || process.env.DATABASE_PROVIDER || "json",
        DATA_DIR: process.env.DATA_DIR || process.env.DATABASE_DIR || "./data",
        DATABASE_DIR: process.env.DATABASE_DIR || process.env.DATA_DIR || "./data",
        BACKUP_DIR: process.env.BACKUP_DIR || "./src/storage/backups",
        TEMP_DIR: process.env.TEMP_DIR || "./src/storage/temp",
        TRANSCRIPT_DIR:
          process.env.TRANSCRIPT_DIR || "./src/storage/transcripts",

        CACHE_PROVIDER: process.env.CACHE_PROVIDER || "memory",
        REDIS_ENABLED: process.env.REDIS_ENABLED || "false",
        REDIS_URL: process.env.REDIS_URL || "",
        BULL_ENABLED: process.env.BULL_ENABLED || "false",
        SLASH_COMMAND_MODE: process.env.SLASH_COMMAND_MODE || "panel",
      },

      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      merge_logs: true,
    },
    {
      name: "hypebotx-dashboard-backend",
      cwd: path.join(repoRoot, "apps", "dashboard-backend"),
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: process.env.PORT || 4000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      merge_logs: true,
    },
    {
      name: "hypebotx-dashboard-frontend",
      cwd: path.join(repoRoot, "apps", "dashboard-frontend"),
      script: path.join(repoRoot, "node_modules", "vite", "bin", "vite.js"),
      args: "preview --host 0.0.0.0 --port 5173",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "production",
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      merge_logs: true,
    },
  ],
};
