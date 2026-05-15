function createAutoBackupJob({ botConfig, logger, backupService }) {
  let timer = null;

  return {
    start(client) {
      if (timer) {
        clearInterval(timer);
      }

      const intervalMs = botConfig.jobs.autoBackupMs;

      timer = setInterval(async () => {
        const startedAt = Date.now();
        const guilds = [...(client.guilds.cache?.values?.() || [])];

        let successCount = 0;
        let failCount = 0;

        for (const guild of guilds) {
          await backupService
            .backupStructure(guild)
            .then(() => {
              successCount += 1;
            })
            .catch((error) => {
              failCount += 1;
              logger.error("auto backup guild failed", {
                guildId: guild?.id,
                message: error?.message || String(error),
                stack: error?.stack,
              });
            });
        }

        logger.info("auto backup sweep result", {
          tookMs: Date.now() - startedAt,
          guilds: guilds.length,
          successCount,
          failCount,
        });
      }, intervalMs);

      logger.info("auto backup job started", { intervalMs });
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        logger.info("auto backup job stopped");
      }
    },
  };
}

module.exports = {
  createAutoBackupJob,
};
