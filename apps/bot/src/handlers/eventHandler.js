const fs = require("fs");
const path = require("path");
const { isGuildAllowed, extractGuildIdFromEventArgs } = require("../utils/guildGuard");

function walkFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function registerEvents(client) {
  const eventsDir = path.join(__dirname, "..", "events");
  const eventFiles = walkFiles(eventsDir);

  for (const filePath of eventFiles) {
    const event = require(filePath);
    if (!event?.name || typeof event.execute !== "function") {
      continue;
    }

    const wrappedExecute = async (...args) => {
      if (!isGuildAllowed(client.container.botConfig, event.name, args)) {
        client.container.logger?.warn?.("event ignored for disallowed guild", {
          event: event.name,
          guildId: extractGuildIdFromEventArgs(args),
        });
        return;
      }

      try {
        await event.execute(client, ...args);
      } catch (error) {
        client.container.logger.error("event execution failed", {
          event: event.name,
          message: error.message,
          stack: error.stack,
        });

        // Universal feature error logger (for bug hunting across features)
        try {
          const { createFeatureErrorLogger } = require("../utils/featureErrorLogger");
          const featureErrorLogger = createFeatureErrorLogger({
            logger: client.container.logger,
            loggingService: client.container.services?.loggingService,
            botConfig: client.container.botConfig,
          });

          const interaction = args?.find((a) => a && typeof a === "object" && (a.customId || a.commandName || a.isChatInputCommand?.()));
          await featureErrorLogger.capture({
            interaction,
            feature: `event:${event.name}`,
            error,
          });
        } catch (logError) {
          client.container.logger.error("feature_error_logging_failed", {
            originalError: error?.message,
            logError: logError?.message,
          });
        }
      }
    };

    if (event.once) {
      client.once(event.name, wrappedExecute);
    } else {
      client.on(event.name, wrappedExecute);
    }
  }

  client.container.logger.info("events loaded", { count: eventFiles.length });
}

module.exports = {
  registerEvents,
};
