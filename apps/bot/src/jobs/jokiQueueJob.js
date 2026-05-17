function createJokiQueueJob({ botConfig, logger, jokiService }) {
  let timer = null;

  function resolveIntervalMs() {
    const parsed = Number(botConfig?.jobs?.jokiSweepMs);
    if (Number.isFinite(parsed) && parsed >= 15_000) {
      return parsed;
    }
    return 60_000;
  }

  return {
    start(client) {
      if (!jokiService?.runAutomationCycle) {
        return;
      }

      if (timer) {
        clearInterval(timer);
      }

      const intervalMs = resolveIntervalMs();

      timer = setInterval(async () => {
        const startedAt = Date.now();
        await jokiService
          .runAutomationCycle(client)
          .then((result) => {
            logger.info("joki automation tick result", {
              tookMs: Date.now() - startedAt,
              updated: result?.updated ?? result?.count ?? null,
            });
          })
          .catch((error) => {
            logger.error("joki automation tick failed", {
              message: error?.message || String(error),
              stack: error?.stack,
            });
          });
      }, intervalMs);

      logger.info("joki queue automation job started", { intervalMs });
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        logger.info("joki queue automation job stopped");
      }
    },
  };
}

module.exports = {
  createJokiQueueJob,
};
