const fs = require("fs");
const path = require("path");

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

function loadCommands(baseDir, logger = null) {
  const commands = [];
  const files = walkFiles(baseDir);

  for (const filePath of files) {
    try {
      const command = require(filePath);
      if (command?.data && typeof command.execute === "function") {
        commands.push({ ...command, __filePath: filePath });
        continue;
      }

      logger?.warn?.("command file ignored: invalid shape", { filePath });
    } catch (error) {
      logger?.error?.("command load failed", { filePath, error: error.message });
    }
  }

  return commands;
}

function registerCommands(client) {
  const commandsDir = path.join(__dirname, "..", "commands");
  const commands = loadCommands(commandsDir, client.container.logger);

  for (const command of commands) {
    if (typeof command.data?.setDMPermission === "function") {
      command.data.setDMPermission(false);
    }
    if (client.commands.has(command.data.name)) {
      client.container.logger.warn("duplicate command name overwritten", {
        name: command.data.name,
        filePath: command.__filePath,
      });
    }
    client.commands.set(command.data.name, command);
  }

  client.container.logger.info("commands loaded", { count: commands.length });
  return commands;
}

module.exports = {
  loadCommands,
  registerCommands,
};
