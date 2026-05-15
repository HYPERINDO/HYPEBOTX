const fs = require("fs");

function ensureFile(filePath, fallback, logger = null) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    logger?.warn?.("migration file path invalid", { filePath });
    return;
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
  }
}

function runMigration(files, logger = null) {
  ensureFile(files.guildConfigs, [], logger);
  ensureFile(files.tickets, [], logger);
  ensureFile(files.orders, [], logger);
  ensureFile(files.payments, [], logger);
  ensureFile(files.roleConfigs, [], logger);
  ensureFile(files.backups, [], logger);
  ensureFile(files.giveaways, [], logger);
  ensureFile(files.afk, {}, logger);
  ensureFile(files.leaderboard, {}, logger);
  ensureFile(files.users, [], logger);
  ensureFile(files.faqs, [], logger);
  ensureFile(files.adminNotes, [], logger);
  ensureFile(files.blacklist, [], logger);
  ensureFile(files.staffLogs, [], logger);
  ensureFile(files.priceList, [], logger);
  ensureFile(files.storeSettings, {}, logger);
  ensureFile(files.counters, {}, logger);

  // Joki system
  ensureFile(files.jokiQueues, [], logger);

  // Stock management (Sprint 2)
  ensureFile(files.stockCategories, [], logger);
  ensureFile(files.stockItems, [], logger);
  ensureFile(files.stockUnits, [], logger);

  // Refund / Dispute (Priority 1)
  ensureFile(files.refundDisputes, [], logger);

  // Backlog operations
  ensureFile(files.coupons, [], logger);
  ensureFile(files.testimonials, [], logger);
  ensureFile(files.jokiShifts, [], logger);
  ensureFile(files.jokiCommissions, [], logger);
  ensureFile(files.mutations, [], logger);
  ensureFile(files.termsAcceptances, [], logger);
  ensureFile(files.sensitiveWarnings, [], logger);
}

module.exports = {
  runMigration,
};
