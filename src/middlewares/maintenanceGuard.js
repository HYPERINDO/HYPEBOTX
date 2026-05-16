const { MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../utils/permissionCheck");
const { createLogger } = require("../utils/logger");
const { safeReply } = require("../utils/discordResponse.js");

// Commands that are always allowed even during maintenance (view-only)
const ALLOWED_COMMANDS = ["price", "faq", "help", "status", "ping"];

const log = createLogger("maintenance-guard");

async function checkMaintenance(interaction, repositories) {
  // Staff/owner always bypass maintenance
  if (isOwnerOrStaff(interaction.member)) return true;

  const safeRepositories = repositories || {};
  const safeStoreRepo = safeRepositories.simpleStoreRepository;

  const settings = await safeStoreRepo?.getSettings?.().catch(() => ({}));
  if (!settings?.maintenanceMode) return true;

  // Allow view-only commands
  const commandName = interaction.commandName || "";
  if (ALLOWED_COMMANDS.includes(commandName)) return true;

  const message = settings.maintenanceMessage || "🔧 Toko sedang maintenance. Silakan coba lagi nanti.";
  await safeReply(interaction, {
    content: message,
    flags: MessageFlags.Ephemeral,
  }).catch((error) => {
    log.warn("Failed to reply to interaction", { error: error.message });
  });

  return false;
}

async function checkMaintenanceForButton(interaction, repositories) {
  if (isOwnerOrStaff(interaction.member)) return true;

  const safeRepositories = repositories || {};
  const safeStoreRepo = safeRepositories.simpleStoreRepository;

  const settings = await safeStoreRepo?.getSettings?.().catch(() => ({}));
  if (!settings?.maintenanceMode) return true;

  const message = settings.maintenanceMessage || "🔧 Toko sedang maintenance. Silakan coba lagi nanti.";
  await safeReply(interaction, {
    content: message,
    flags: MessageFlags.Ephemeral,
  }).catch((error) => {
    log.warn("Failed to reply to button interaction", { error: error.message });
  });

  return false;
}

module.exports = {
  checkMaintenance,
  checkMaintenanceForButton,
  ALLOWED_COMMANDS,
};
