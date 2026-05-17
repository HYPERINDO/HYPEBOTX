/**
 * Error Tracking Service
 * Monitors and tracks errors across all bot features
 * Provides error analytics, patterns, and reporting
 */

function createErrorTrackingService({ logger, database }) {
    // In-memory error tracking (can be persisted to database)
    const errorLog = {
        music: [],
        fun: [],
        joki: [],
        store: [],
        ticket: [],
        setup: [],
        structure: [],
        database: [],
        voice: [],
        interaction: [],
        general: [],
    };

    // Feature categories
    const FEATURE_CATEGORIES = {
        // Music commands (9)
        play: "music",
        pause: "music",
        resume: "music",
        skip: "music",
        queue: "music",
        loop: "music",
        volume: "music",
        leave: "music",
        nowPlaying: "music",

        // Fun commands (10)
        afk: "fun",
        coinflip: "fun",
        eightBall: "fun",
        giveaway: "fun",
        leaderboard: "fun",
        meme: "fun",
        quiz: "fun",
        quote: "fun",
        roll: "fun",
        trivia: "fun",

        // Joki commands (2)
        jokiQueue: "joki",
        jokiStatus: "joki",

        // Store/Order commands (4)
        warrantyClaim: "store",
        stockUpdate: "store",
        closeOrder: "store",
        openOrder: "store",

        // Ticket commands (4)
        closeTicket: "ticket",
        claimTicket: "ticket",
        reopenTicket: "ticket",
        setOrderStatus: "ticket",

        // Setup commands (8)
        sendPaymentPanel: "setup",
        sendPromoPanel: "setup",
        sendVerifyPanel: "setup",
        sendTicketPanel: "setup",
        sendRolePanel: "setup",
        setupGamestore: "setup",
        setupBasic: "setup",
        setupRoles: "setup",

        // Structure commands (6)
        rapihin: "structure",
        backupStructure: "structure",
        auditServer: "structure",
        restoreStructure: "structure",
        renameChannels: "structure",
        sortChannels: "structure",
    };

    /**
     * Log an error occurrence
     */
    function trackError({
        command,
        feature,
        userId,
        guildId,
        error,
        context = {},
    }) {
        const category = FEATURE_CATEGORIES[command] || feature || "general";
        const timestamp = new Date().toISOString();

        const errorEntry = {
            timestamp,
            command,
            feature: category,
            userId,
            guildId,
            message: error?.message || String(error),
            stack: error?.stack,
            context,
            occurrences: 1,
        };

        // Find if similar error exists
        const existingError = errorLog[category]?.find(
            (e) =>
                e.command === command &&
                e.message === errorEntry.message &&
                Date.now() - new Date(e.timestamp).getTime() < 3600000, // Within 1 hour
        );

        if (existingError) {
            existingError.occurrences += 1;
            existingError.lastOccurred = timestamp;
        } else {
            if (!errorLog[category]) {
                errorLog[category] = [];
            }
            errorLog[category].push(errorEntry);
        }

        // Keep only last 100 errors per category
        if (errorLog[category].length > 100) {
            errorLog[category].shift();
        }

        logger.error("feature error tracked", {
            command,
            feature: category,
            error: errorEntry.message,
            occurrences: existingError?.occurrences || 1,
        });
    }

    /**
     * Get error summary by feature
     */
    function getErrorSummary() {
        const summary = {};

        for (const [feature, errors] of Object.entries(errorLog)) {
            if (errors.length === 0) continue;

            const totalOccurrences = errors.reduce((sum, e) => sum + e.occurrences, 0);
            const uniqueErrors = new Set(errors.map((e) => e.message));

            summary[feature] = {
                totalErrors: errors.length,
                totalOccurrences,
                uniqueErrorTypes: uniqueErrors.size,
                recentError: errors[errors.length - 1],
                topErrors: errors
                    .sort((a, b) => b.occurrences - a.occurrences)
                    .slice(0, 3)
                    .map((e) => ({
                        message: e.message,
                        occurrences: e.occurrences,
                        lastSeen: e.lastOccurred || e.timestamp,
                    })),
            };
        }

        return summary;
    }

    /**
     * Get errors for a specific feature
     */
    function getFeatureErrors(feature) {
        return errorLog[feature] || [];
    }

    /**
     * Get errors for a specific command
     */
    function getCommandErrors(command) {
        const feature = FEATURE_CATEGORIES[command] || "general";
        return (errorLog[feature] || []).filter((e) => e.command === command);
    }

    /**
     * Get all errors with optional filters
     */
    function getAllErrors(filters = {}) {
        const { feature, command, userId, guildId, limit = 50 } = filters;
        let results = [];

        // Collect all errors
        for (const errors of Object.values(errorLog)) {
            results = results.concat(errors);
        }

        // Apply filters
        if (feature) {
            results = results.filter((e) => e.feature === feature);
        }
        if (command) {
            results = results.filter((e) => e.command === command);
        }
        if (userId) {
            results = results.filter((e) => e.userId === userId);
        }
        if (guildId) {
            results = results.filter((e) => e.guildId === guildId);
        }

        // Sort by timestamp descending and limit
        return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }

    /**
     * Clear errors (by feature or all)
     */
    function clearErrors(feature) {
        if (feature) {
            errorLog[feature] = [];
        } else {
            for (const key in errorLog) {
                errorLog[key] = [];
            }
        }
    }

    /**
     * Get health status of features
     */
    function getHealthStatus() {
        const health = {};

        for (const [feature, errors] of Object.entries(errorLog)) {
            const totalOccurrences = errors.reduce((sum, e) => sum + e.occurrences, 0);
            let status = "✅ Healthy";

            if (totalOccurrences >= 50) {
                status = "🔴 Critical";
            } else if (totalOccurrences >= 20) {
                status = "🟠 Warning";
            } else if (totalOccurrences >= 5) {
                status = "🟡 Caution";
            }

            health[feature] = {
                status,
                errors: errors.length,
                occurrences: totalOccurrences,
            };
        }

        return health;
    }

    logger.info("error tracking service ready");

    return {
        trackError,
        getErrorSummary,
        getFeatureErrors,
        getCommandErrors,
        getAllErrors,
        clearErrors,
        getHealthStatus,
        FEATURE_CATEGORIES,
    };
}

module.exports = {
    createErrorTrackingService,
};
