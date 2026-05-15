function createPaymentReminderJob({ botConfig, logger, paymentService }) {
    let timer = null;

    function resolveIntervalMs() {
        const parsed = Number(botConfig?.jobs?.paymentReminderSweepMs);
        if (Number.isFinite(parsed) && parsed >= 15_000) return parsed;
        return 5 * 60 * 1000;
    }

    function resolveThresholdMs() {
        const minutes = Number(botConfig?.jobs?.paymentReminderThresholdMinutes ?? 30);
        if (!Number.isFinite(minutes) || minutes <= 0) return 30 * 60 * 1000;
        return minutes * 60 * 1000;
    }

    function resolveCooldownMs() {
        const minutes = Number(botConfig?.jobs?.paymentReminderCooldownMinutes ?? 45);
        if (!Number.isFinite(minutes) || minutes <= 0) return 45 * 60 * 1000;
        return minutes * 60 * 1000;
    }

    function resolveMaxAlerts() {
        const parsed = Number(botConfig?.jobs?.paymentReminderMaxAlertsPerSweep ?? 50);
        if (!Number.isFinite(parsed) || parsed <= 0) return 50;
        return Math.floor(parsed);
    }

    return {
        start(client) {
            if (!paymentService?.sweepUnpaidOrdersForReminder) return;

            if (timer) clearInterval(timer);

            const intervalMs = resolveIntervalMs();
            const thresholdMs = resolveThresholdMs();
            const cooldownMs = resolveCooldownMs();
            const maxAlerts = resolveMaxAlerts();

            timer = setInterval(async () => {
                const startedAt = Date.now();
                await paymentService
                    .sweepUnpaidOrdersForReminder({
                        client,
                        thresholdMs,
                        cooldownMs,
                        maxAlerts,
                    })
                    .then((result) => {
                        logger.info("payment reminder sweep result", {
                            reminded: result?.reminded ?? null,
                            candidates: result?.candidates ?? null,
                            tookMs: Date.now() - startedAt,
                        });
                    })
                    .catch((error) => {
                        logger.error("payment reminder job failed", {
                            message: error?.message || String(error),
                            stack: error?.stack,
                        });
                    });
            }, intervalMs);

            logger.info("payment reminder job started", { intervalMs, thresholdMs, cooldownMs, maxAlerts });
        },

        stop() {
            if (!timer) return;
            clearInterval(timer);
            timer = null;
            logger.info("payment reminder job stopped");
        },
    };
}

module.exports = {
    createPaymentReminderJob,
};
