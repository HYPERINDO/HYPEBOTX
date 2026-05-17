const fs = require("fs");
const path = require("path");

function safeConsoleWrite(method, ...args) {
  try {
    const fn = typeof console?.[method] === "function" ? console[method] : console.log;
    fn(...args);
  } catch (error) {
    if (error?.code === "EPIPE") return;
    throw error;
  }
}

function cleanupOldLogs(logsDir, retentionDays = 30) {
  try {
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const entries = fs.readdirSync(logsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !/^bot-\d{4}-\d{2}-\d{2}\.log$/.test(entry.name)) {
        continue;
      }

      const fullPath = path.join(logsDir, entry.name);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch (error) {
    safeConsoleWrite("error", "Failed to cleanup old logs:", error.message);
  }
}

function createLogger(scope = "bot") {
  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  cleanupOldLogs(logsDir, 30);

  const logFile = path.join(logsDir, `bot-${new Date().toISOString().split("T")[0]}.log`);

  function writeLog(level, message, extra) {
    const time = new Date().toISOString();
    const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
    const logMessage = `[${time}] [${scope}] [${level}] ${message}${suffix}`;

    // Console output
    safeConsoleWrite("log", logMessage);

    // File output
    try {
      fs.appendFileSync(logFile, logMessage + "\n", "utf8");
    } catch (error) {
      safeConsoleWrite("error", "Failed to write to log file:", error.message);
    }
  }

  return {
    debug(message, extra) {
      writeLog("DEBUG", message, extra);
    },
    info(message, extra) {
      writeLog("INFO", message, extra);
    },
    warn(message, extra) {
      writeLog("WARN", message, extra);
    },
    error(message, extra) {
      writeLog("ERROR", message, extra);
    },
  };
}

module.exports = {
  createLogger,
};
