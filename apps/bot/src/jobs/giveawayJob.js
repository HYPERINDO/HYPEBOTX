function createGiveawayJob({ logger, funService }) {
  let timer = null;

  return {
    start(client) {
      if (timer) {
        clearInterval(timer);
      }

      const intervalMs = 15 * 1000;

      timer = setInterval(async () => {
        const startedAt = Date.now();
        await funService
          .sweepGiveaways(client)
          .then((result) => {
            logger.info("giveaway sweep result", {
              tookMs: Date.now() - startedAt,
              // best-effort: if service returns counts
              updated: result?.updated ?? result?.count ?? null,
            });
          })
          .catch((error) => {
            logger.error("giveaway sweep failed", {
              message: error?.message || String(error),
              stack: error?.stack,
            });
          });
      }, intervalMs);

      logger.info("giveaway job started", { intervalMs });
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        logger.info("giveaway job stopped");
      }
    },
  };
}

module.exports = {
  createGiveawayJob,
};
