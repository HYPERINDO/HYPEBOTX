function createAutoCloseTicketJob({ botConfig, logger, ticketService }) {
  let timer = null;

  return {
    start(client) {
      if (timer) {
        clearInterval(timer);
      }

      const intervalMs = botConfig.jobs.ticketSweepMs;

      timer = setInterval(async () => {
        const startedAt = Date.now();
        await ticketService
          .sweepInactiveTickets(client)
          .then((result) => {
            logger.info("ticket auto close sweep result", {
              tookMs: Date.now() - startedAt,
              closed: result?.closedCount ?? result?.closed ?? null,
              candidates: result?.candidates ?? null,
            });
          })
          .catch((error) => {
            logger.error("ticket auto close failed", {
              message: error?.message || String(error),
              stack: error?.stack,
            });
          });
      }, intervalMs);

      logger.info("ticket auto close job started", {
        hours: botConfig.jobs.ticketAutoCloseHours,
        intervalMs,
      });
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        logger.info("ticket auto close job stopped");
      }
    },
  };
}

module.exports = {
  createAutoCloseTicketJob,
};
