const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function resolveEnvPath() {
  const preferred = process.env.ENV_FILE || ".env.local";
  const preferredPath = path.resolve(process.cwd(), preferred);
  if (fs.existsSync(preferredPath)) return preferredPath;
  return path.resolve(process.cwd(), ".env");
}

dotenv.config({ path: resolveEnvPath() });

const { createApp } = require("./app");

function isEnvEnabled(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  return ["1", "true", "yes", "y", "on"].includes(String(raw).trim().toLowerCase());
}

function safeStderrWrite(message) {
  try {
    if (process?.stderr?.writable) {
      process.stderr.write(`${message}\n`);
    }
  } catch {
    // ignore stream write failures (e.g., EPIPE)
  }
}

function attachPipeGuards() {
  const swallowEpipe = (error) => {
    if (error?.code === "EPIPE") {
      return;
    }
    throw error;
  };

  process.stdout?.on?.("error", swallowEpipe);
  process.stderr?.on?.("error", swallowEpipe);
}

attachPipeGuards();

function printStartupBanner() {
  const bannerEnabled = isEnvEnabled("STARTUP_HACKER_BANNER", true);
  if (!bannerEnabled) return;

  const colorEnabled = Boolean(process.stdout?.isTTY) && !isEnvEnabled("NO_COLOR", false);
  const green = colorEnabled ? "\x1b[32m" : "";
  const dim = colorEnabled ? "\x1b[2m" : "";
  const reset = colorEnabled ? "\x1b[0m" : "";

  const nowIso = new Date().toISOString();
  const nodeVersion = process.version;
  const pid = process.pid;

  const lines = [
    "====================================================================",
    " _   _ __   _______ ____   ___ _____ ____ _______  __",
    "| | | |\\ \\ / /  _ \\ __ ) / _ \\_   _|  _ \\_   _\\ \\/ /",
    "| |_| | \\ V /| |_) |  _ \\| | | || | | |_) || |  \\  / ",
    "|  _  |  | | |  __/| |_) | |_| || | |  _ < | |  /  \\ ",
    "|_| |_|  |_| |_|   |____/ \\___/ |_| |_| \\_\\|_| /_/\\_\\",
    "--------------------------------------------------------------------",
    `[HYPEBOTX::BOOT] profile=HACKER-TTY node=${nodeVersion} pid=${pid}`,
    `[HYPEBOTX::BOOT] startup_at=${nowIso}`,
    "[HYPEBOTX::BOOT] loading core modules... OK",
    "[HYPEBOTX::BOOT] waiting for discord gateway...",
    "====================================================================",
  ];

  const output = `${green}${lines.join("\n")}${reset}\n`;
  const finalOutput = colorEnabled ? output : `${dim}${output}${reset}`;

  try {
    if (process?.stdout?.writable) {
      process.stdout.write(finalOutput);
    }
  } catch {
    // keep startup resilient if stdout stream is unavailable
  }
}

printStartupBanner();

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  safeStderrWrite(`[CRITICAL] Unhandled Rejection: ${String(reason)}`);
  safeStderrWrite(`Promise: ${String(promise)}`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  if (error?.code === "EPIPE") {
    safeStderrWrite("[WARN] Ignored uncaught EPIPE (stream pipe closed).");
    return;
  }

  safeStderrWrite(`[CRITICAL] Uncaught Exception: ${String(error?.stack || error)}`);
  process.exit(1);
});

const app = createApp();

// Handle graceful shutdown
const gracefulShutdown = async () => {
  safeStderrWrite("[SHUTDOWN] Received shutdown signal, closing bot gracefully...");
  try {
    if (app.shutdown) {
      await app.shutdown();
    }
    app.client.destroy();
    safeStderrWrite("[SHUTDOWN] Bot disconnected successfully");
    process.exit(0);
  } catch (error) {
    safeStderrWrite(`[SHUTDOWN] Error during shutdown: ${String(error?.stack || error)}`);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

app.start();
