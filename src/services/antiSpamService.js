const { createLogger } = require("../utils/logger");

/**
 * Anti-Spam Service
 * Handles spam detection, rate limiting, and automatic enforcement
 */
function createAntiSpamService({ botConfig, logger, cacheService, loggingService }) {
    const log = logger || createLogger("antiSpam");
    const config = botConfig.antiSpam || {
        messageThreshold: 5,
        messageWindow: 5000, // 5 seconds
        mentionThreshold: 3,
        linkThreshold: 2,
        capsThreshold: 0.8,
        timeoutDuration: 60000, // 1 minute
    };

    // In-memory storage for spam patterns
    const spamPatterns = {
        messageSpam: new Map(), // userId -> Array of timestamps
        mentionSpam: new Map(),
        linkSpam: new Map(),
        capsSpam: new Map(),
        violators: new Map(), // userId -> violation count
    };

    /**
     * Check for message spam
     */
    function checkMessageSpam(userId) {
        const now = Date.now();
        const userMessages = spamPatterns.messageSpam.get(userId) || [];

        // Remove old timestamps outside window
        const recentMessages = userMessages.filter(t => now - t < config.messageWindow);
        spamPatterns.messageSpam.set(userId, recentMessages);

        recentMessages.push(now);
        spamPatterns.messageSpam.set(userId, recentMessages);

        return recentMessages.length > config.messageThreshold;
    }

    /**
     * Check for mention spam
     */
    function getMentionCount(message) {
        const users = message?.mentions?.users?.size || 0;
        const roles = message?.mentions?.roles?.size || 0;
        const everyone = message?.mentions?.everyone ? 1 : 0;
        return users + roles + everyone;
    }

    function checkMentionSpam(message) {
        return getMentionCount(message) > config.mentionThreshold;
    }

    /**
     * Check for link spam
     */
    function checkLinkSpam(content) {
        const linkPattern = /(https?:\/\/[^\s]+)/gi;
        const links = content.match(linkPattern) || [];
        return links.length > config.linkThreshold;
    }

    /**
     * Check for CAPS spam
     */
    function checkCapsSpam(content) {
        if (content.length < 10) return false;

        const capsCount = (content.match(/[A-Z]/g) || []).length;
        const capsRatio = capsCount / content.length;

        return capsRatio > config.capsThreshold;
    }

    /**
     * Check for rapid command execution
     */
    function checkCommandSpam(userId, commandName) {
        const key = `command:${userId}:${commandName}`;
        const userCommands = spamPatterns.messageSpam.get(key) || [];
        const now = Date.now();

        // Remove old timestamps
        const recentCommands = userCommands.filter(t => now - t < config.messageWindow);
        spamPatterns.messageSpam.set(key, recentCommands);

        recentCommands.push(now);
        spamPatterns.messageSpam.set(key, recentCommands);

        return recentCommands.length > 2; // Max 2 commands per window
    }

    /**
     * Analyze message for spam
     */
    async function analyzeMessage(message) {
        const violations = [];

        // Check message spam
        if (checkMessageSpam(message.author.id)) {
            violations.push({
                type: "MESSAGE_SPAM",
                severity: "medium",
                reason: "Sending messages too quickly",
            });
        }

        // Check mention spam
        if (checkMentionSpam(message)) {
            const mentionCount = getMentionCount(message);
            violations.push({
                type: "MENTION_SPAM",
                severity: "high",
                reason: `Too many mentions (${mentionCount})`,
            });
        }

        // Check link spam
        if (checkLinkSpam(message.content)) {
            violations.push({
                type: "LINK_SPAM",
                severity: "medium",
                reason: "Posting too many links",
            });
        }

        // Check CAPS spam
        if (checkCapsSpam(message.content)) {
            violations.push({
                type: "CAPS_SPAM",
                severity: "low",
                reason: "Excessive capitalization",
            });
        }

        return {
            isSpam: violations.length > 0,
            violations,
        };
    }

    /**
     * Handle spam violation
     */
    async function handleViolation(message, violation) {
        const userId = message.author.id;
        const violations = spamPatterns.violators.get(userId) || 0;
        const newViolationCount = violations + 1;

        spamPatterns.violators.set(userId, newViolationCount);

        log.warn("[ANTI-SPAM] Violation detected", {
            userId,
            username: message.author.tag,
            type: violation.type,
            severity: violation.severity,
            violationCount: newViolationCount,
        });

        // Auto timeout on repeated violations
        if (newViolationCount >= 3) {
            try {
                await message.member.timeout(config.timeoutDuration, `Anti-spam: ${violation.type}`);
                log.info("[ANTI-SPAM] User timed out", {
                    userId,
                    username: message.author.tag,
                    duration: config.timeoutDuration,
                });

                // Notify
                try {
                    await message.reply({
                        content: `Timeout ${config.timeoutDuration / 1000}s karena spam.`,
                        allowedMentions: { repliedUser: false },
                    });
                } catch (error) {
                    log.warn("[ANTI-SPAM] Failed to notify user", { error: error.message });
                }
            } catch (error) {
                log.error("[ANTI-SPAM] Failed to timeout user", { error: error.message });
            }
        }

        // Log to Discord if available
        if (loggingService) {
            try {
                await loggingService.logModeration(
                    message.guild,
                    "Spam Detected",
                    `${message.author.tag} terdeteksi spam (${violation.type}).`,
                    [
                        { name: "User", value: message.author.tag, inline: true },
                        { name: "User ID", value: userId, inline: true },
                        { name: "Severity", value: violation.severity, inline: true },
                        { name: "Reason", value: violation.reason, inline: false },
                        { name: "Violation Count", value: String(newViolationCount), inline: true },
                    ],
                );
            } catch (error) {
                log.warn("[ANTI-SPAM] Failed to log moderation", { error: error.message });
            }
        }

        return newViolationCount;
    }

    /**
     * Reset user violations
     */
    function resetUserViolations(userId) {
        spamPatterns.violators.delete(userId);
        spamPatterns.messageSpam.delete(userId);
        spamPatterns.mentionSpam.delete(userId);
        spamPatterns.linkSpam.delete(userId);
        spamPatterns.capsSpam.delete(userId);

        log.info("[ANTI-SPAM] User violations reset", { userId });
    }

    /**
     * Get violation report
     */
    function getViolationReport(userId) {
        return {
            userId,
            violationCount: spamPatterns.violators.get(userId) || 0,
            messageSpamInstances: (spamPatterns.messageSpam.get(userId) || []).length,
            status: spamPatterns.violators.get(userId) ? "flagged" : "clean",
        };
    }

    /**
     * Get spam statistics
     */
    function getSpamStats() {
        const allViolators = Array.from(spamPatterns.violators.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            totalViolators: spamPatterns.violators.size,
            topViolators: allViolators.map(([userId, count]) => ({
                userId,
                violations: count,
            })),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Cleanup old spam records
     */
    function cleanup() {
        const now = Date.now();

        // Clean message spam records older than window
        for (const [userId, timestamps] of spamPatterns.messageSpam.entries()) {
            const recent = timestamps.filter(t => now - t < config.messageWindow);
            if (recent.length === 0) {
                spamPatterns.messageSpam.delete(userId);
            } else {
                spamPatterns.messageSpam.set(userId, recent);
            }
        }

        if (typeof log.debug === "function") {
            log.debug("[ANTI-SPAM] Cleanup completed");
        } else {
            log.info("[ANTI-SPAM] Cleanup completed");
        }
    }

    // Start cleanup interval
    const cleanupInterval = setInterval(() => cleanup(), 60000); // Every minute

    return {
        analyzeMessage,
        handleViolation,
        resetUserViolations,
        getViolationReport,
        getSpamStats,
        checkMessageSpam,
        checkMentionSpam,
        checkLinkSpam,
        checkCapsSpam,
        checkCommandSpam,
        cleanup,
        stop: () => clearInterval(cleanupInterval),
    };
}

module.exports = { createAntiSpamService };
