import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const appRoot = path.resolve(__dirname, "..", "..");
export const repoRoot = path.resolve(appRoot, "..", "..");

const envFile = process.env.ENV_FILE || ".env";
const envCandidates = [
  path.join(appRoot, envFile),
  path.join(appRoot, ".env.local"),
  path.join(appRoot, ".env"),
  path.join(repoRoot, envFile),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, ".env"),
];

const resolvedEnvPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (resolvedEnvPath) {
  dotenv.config({ path: resolvedEnvPath, override: true });
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveFromApp(value, fallback) {
  const raw = value || fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(appRoot, raw);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  frontendUrl: (process.env.FRONTEND_URL || process.env.DASHBOARD_PUBLIC_URL || "http://localhost:5173").replace(/\/+$/, ""),
  backendUrl: (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, ""),
  sessionSecret: process.env.DASHBOARD_SESSION_SECRET || "dev-secret-change-me",
  cookieSecure: ["1", "true", "yes", "on"].includes(
    String(process.env.DASHBOARD_COOKIE_SECURE || process.env.COOKIE_SECURE || (process.env.NODE_ENV === "production")).toLowerCase(),
  ),
  sessionTtlMs: Number(process.env.DASHBOARD_SESSION_TTL_MS || 1000 * 60 * 60 * 24),
  discordClientId: process.env.DISCORD_CLIENT_ID || process.env.DASHBOARD_DISCORD_CLIENT_ID || "",
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || process.env.DASHBOARD_DISCORD_CLIENT_SECRET || "",
  discordRedirectUri:
    process.env.DISCORD_REDIRECT_URI ||
    process.env.DASHBOARD_DISCORD_REDIRECT_URI ||
    "http://localhost:4000/api/auth/discord/callback",
  discordGuildId: process.env.DISCORD_GUILD_ID || process.env.DASHBOARD_GUILD_ID || process.env.GUILD_ID || "",
  ownerDiscordIds: csv(process.env.OWNER_DISCORD_IDS),
  adminRoleId: process.env.ADMIN_ROLE_ID || "",
  penjokiRoleId: process.env.PENJOKI_ROLE_ID || "",
  botStorageDir: resolveFromApp(process.env.BOT_STORAGE_DIR, "../../apps/bot/src/storage/temp"),
  dashboardStorageDir: resolveFromApp(process.env.DASHBOARD_STORAGE_DIR, "./logs/data"),
};
