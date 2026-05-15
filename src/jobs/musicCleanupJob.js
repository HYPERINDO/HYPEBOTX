function createMusicCleanupJob({ logger, musicService }) {
  let timer = null;

  return {
    start() {
      if (timer) {
        clearInterval(timer);
      }

      const intervalMs = 60 * 1000;

      timer = setInterval(async () => {
        const startedAt = Date.now();
        try {
          const result = await musicService.cleanupIdleQueues?.();
          logger.info("music cleanup sweep result", {
            tookMs: Date.now() - startedAt,
            cleaned: result?.cleaned ?? result?.count ?? null,
          });
        } catch (error) {
          logger.error("music cleanup sweep failed", {
            message: error?.message || String(error),
            stack: error?.stack,
          });
        }
      }, intervalMs);

      logger.info("music cleanup job started", { intervalMs });
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        logger.info("music cleanup job stopped");
      }
    },
  };
}

module.exports = {
  createMusicCleanupJob,
};
