require("dotenv").config();

const { createApp } = require("./app");

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
