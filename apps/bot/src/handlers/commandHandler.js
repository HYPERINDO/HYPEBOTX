const fs = require("fs");
const path = require("path");

const PANEL_COMMAND_NAMES = new Set([
  "panel",
  "admin",
  "owner",
  "dev",
  "setup-panel",
  "sync-panel",
]);

const LEGACY_SETUP_COMMAND_NAMES = new Set([
  "setup",
  "setup-basic",
  "setup-gamestore",
  "setup-roles",
  "send-verify-panel",
  "send-role-panel",
  "send-ticket-panel",
  "send-payment-panel",
  "send-promo-panel",
  "format",
]);

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

function getSlashCommandMode() {
  return String(process.env.SLASH_COMMAND_MODE || process.env.DEPLOY_COMMAND_SCOPE || "standard")
    .trim()
    .toLowerCase();
}

function filterCommandsForRegistration(commands, mode = getSlashCommandMode()) {
  if (mode === "full" || mode === "legacy_full") {
    return commands;
  }

  if (mode === "standard" || mode === "expanded" || mode === "visible") {
    return commands.filter((command) => !LEGACY_SETUP_COMMAND_NAMES.has(command?.data?.name));
  }

  if (mode === "legacy_minimal") {
    const keepAdminNames = new Set(["maintenance", "health", "audit", "export", "guide", "note"]);

    return commands.filter((command) => {
      const cmdName = command?.data?.name;
      if (!cmdName) return false;
      if (String(command?.__filePath || "").includes(`${path.sep}setup${path.sep}`)) return false;
      if (LEGACY_SETUP_COMMAND_NAMES.has(cmdName)) return false;
      if (String(command?.__filePath || "").includes(`${path.sep}admin${path.sep}`)) {
        return keepAdminNames.has(cmdName);
      }
      return true;
    });
  }

  return commands.filter((command) => PANEL_COMMAND_NAMES.has(command?.data?.name));
}

function toUniqueCommandJson(commands) {
  const seen = new Set();
  return commands
    .map((command) => command?.data?.toJSON?.())
    .filter((commandJson) => {
      const name = commandJson?.name;
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
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
  LEGACY_SETUP_COMMAND_NAMES,
  PANEL_COMMAND_NAMES,
  filterCommandsForRegistration,
  getSlashCommandMode,
  loadCommands,
  registerCommands,
  toUniqueCommandJson,
};
