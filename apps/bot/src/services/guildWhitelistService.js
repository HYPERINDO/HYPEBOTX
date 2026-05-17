const { createLogger } = require("../utils/logger");

/**
 * Guild Whitelist Service
 * Manages server whitelist and validates guild access
 */
function createGuildWhitelistService({ botConfig, logger, repositories }) {
    const log = logger || createLogger("guildWhitelist");
    const allowedGuildIds = new Set(botConfig.allowedGuildIds || []);

    // Cache for guild verification results
    const verificationCache = new Map();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Check if a guild is whitelisted
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<boolean>}
     */
    async function isGuildWhitelisted(guildId) {
        if (!guildId) {
            return false;
        }

        // Check cache first
        const cached = verificationCache.get(guildId);
        if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
            return cached.allowed;
        }

        // Check whitelist
        const allowed = allowedGuildIds.has(guildId);

        // Update cache
        verificationCache.set(guildId, {
            allowed,
            timestamp: Date.now(),
        });

        if (!allowed) {
            log.warn("[WHITELIST] Unauthorized guild access attempt", { guildId });
        }

        return allowed;
    }

    /**
     * Add guild to whitelist
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<boolean>}
     */
    async function addGuildToWhitelist(guildId) {
        if (!guildId) {
            return false;
        }

        if (allowedGuildIds.has(guildId)) {
            return false; // Already whitelisted
        }

        allowedGuildIds.add(guildId);
        verificationCache.delete(guildId); // Invalidate cache

        log.info("[WHITELIST] Guild added to whitelist", { guildId });

        // Persist to database if repository available
        if (repositories?.guildRepository) {
            try {
                await repositories.guildRepository.updateGuildConfig(guildId, {
                    whitelisted: true,
                    whitelistedAt: new Date(),
                });
            } catch (error) {
                log.warn("[WHITELIST] Failed to persist whitelist change", { guildId, error: error.message });
            }
        }

        return true;
    }

    /**
     * Remove guild from whitelist
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<boolean>}
     */
    async function removeGuildFromWhitelist(guildId) {
        if (!guildId || !allowedGuildIds.has(guildId)) {
            return false;
        }

        allowedGuildIds.delete(guildId);
        verificationCache.delete(guildId); // Invalidate cache

        log.info("[WHITELIST] Guild removed from whitelist", { guildId });

        // Persist to database if repository available
        if (repositories?.guildRepository) {
            try {
                await repositories.guildRepository.updateGuildConfig(guildId, {
                    whitelisted: false,
                    removedAt: new Date(),
                });
            } catch (error) {
                log.warn("[WHITELIST] Failed to persist whitelist change", { guildId, error: error.message });
            }
        }

        return true;
    }

    /**
     * Get all whitelisted guild IDs
     * @returns {string[]}
     */
    function getWhitelistedGuildIds() {
        return Array.from(allowedGuildIds);
    }

    /**
     * Log unauthorized access attempt
     * @param {string} guildId - Discord guild ID
     * @param {string} userId - Discord user ID
     * @param {string} action - Action attempted
     */
    async function logUnauthorizedAccess(guildId, userId, action) {
        log.warn("[WHITELIST] Unauthorized access attempt blocked", {
            guildId,
            userId,
            action,
            timestamp: new Date().toISOString(),
        });

        // Persist to database if available
        if (repositories?.guildRepository) {
            try {
                await repositories.guildRepository.logAccessDenial(guildId, userId, action);
            } catch (error) {
                log.warn("[WHITELIST] Failed to log access denial", { error: error.message });
            }
        }
    }

    /**
     * Validate guild for command execution
     * @param {Guild} guild - Discord guild object
     * @param {string} commandName - Command name being executed
     * @returns {Promise<{valid: boolean, reason?: string}>}
     */
    async function validateGuildAccess(guild, commandName) {
        if (!guild) {
            return {
                valid: false,
                reason: "Guild not found",
            };
        }

        const isWhitelisted = await isGuildWhitelisted(guild.id);
        if (!isWhitelisted) {
            return {
                valid: false,
                reason: "This server is not authorized to use this bot",
            };
        }

        return { valid: true };
    }

    /**
     * Clear verification cache
     */
    function clearCache() {
        verificationCache.clear();
        log.info("[WHITELIST] Verification cache cleared");
    }

    /**
     * Get cache statistics
     */
    function getCacheStats() {
        return {
            cachedGuilds: verificationCache.size,
            whitelistedGuilds: allowedGuildIds.size,
            cacheEntries: Array.from(verificationCache.entries()).map(([guildId, data]) => ({
                guildId,
                cached: true,
                allowed: data.allowed,
                age: Date.now() - data.timestamp,
            })),
        };
    }

    return {
        isGuildWhitelisted,
        addGuildToWhitelist,
        removeGuildFromWhitelist,
        getWhitelistedGuildIds,
        logUnauthorizedAccess,
        validateGuildAccess,
        clearCache,
        getCacheStats,
    };
}

module.exports = { createGuildWhitelistService };
