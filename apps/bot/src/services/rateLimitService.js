const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');

class RateLimitService {
    constructor(config, cacheService, logger) {
        this.config = config.rateLimit;
        this.cacheService = cacheService;
        this.logger = logger;
        this.limiters = {};
        this.isRedisAvailable = cacheService && cacheService.isConnected;
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) {
            return; // Prevent re-initialization
        }
        // Global rate limiter
        this.limiters.global = this.isRedisAvailable
            ? new RateLimiterRedis({
                storeClient: this.cacheService.client,
                keyPrefix: 'ratelimit:global',
                points: this.config.global.max,
                duration: this.config.global.windowMs / 1000,
            })
            : new RateLimiterMemory({
                keyPrefix: 'ratelimit:global',
                points: this.config.global.max,
                duration: this.config.global.windowMs / 1000,
            });

        // Command rate limiter
        this.limiters.command = this.isRedisAvailable
            ? new RateLimiterRedis({
                storeClient: this.cacheService.client,
                keyPrefix: 'ratelimit:command',
                points: this.config.command.max,
                duration: this.config.command.windowMs / 1000,
            })
            : new RateLimiterMemory({
                keyPrefix: 'ratelimit:command',
                points: this.config.command.max,
                duration: this.config.command.windowMs / 1000,
            });

        // AI rate limiter
        this.limiters.ai = this.isRedisAvailable
            ? new RateLimiterRedis({
                storeClient: this.cacheService.client,
                keyPrefix: 'ratelimit:ai',
                points: this.config.ai.max,
                duration: this.config.ai.windowMs / 1000,
            })
            : new RateLimiterMemory({
                keyPrefix: 'ratelimit:ai',
                points: this.config.ai.max,
                duration: this.config.ai.windowMs / 1000,
            });

        this.logger.info(`[RATELIMIT] Initialized with ${this.isRedisAvailable ? 'Redis' : 'Memory'} store`);
        this.initialized = true;
    }

    async checkGlobalLimit(key) {
        try {
            await this.limiters.global.consume(key);
            return { allowed: true };
        } catch (rejRes) {
            return {
                allowed: false,
                resetTime: new Date(Date.now() + rejRes.msBeforeNext),
                remaining: rejRes.remainingPoints,
            };
        }
    }

    async checkCommandLimit(userId, commandName) {
        const key = `${userId}:${commandName}`;
        try {
            await this.limiters.command.consume(key);
            return { allowed: true };
        } catch (rejRes) {
            return {
                allowed: false,
                resetTime: new Date(Date.now() + rejRes.msBeforeNext),
                remaining: rejRes.remainingPoints,
            };
        }
    }

    async checkAILimit(userId) {
        try {
            await this.limiters.ai.consume(userId);
            return { allowed: true };
        } catch (rejRes) {
            return {
                allowed: false,
                resetTime: new Date(Date.now() + rejRes.msBeforeNext),
                remaining: rejRes.remainingPoints,
            };
        }
    }

    // Middleware for Discord interactions
    async checkInteraction(interaction) {
        const userId = interaction.user.id;
        const commandName = interaction.commandName || 'unknown';

        // Check global limit
        const globalCheck = await this.checkGlobalLimit(userId);
        if (!globalCheck.allowed) {
            return {
                allowed: false,
                type: 'global',
                resetTime: globalCheck.resetTime,
                message: `Rate limit exceeded. Try again ${this.formatTimeRemaining(globalCheck.resetTime)}.`,
            };
        }

        // Check command limit
        const commandCheck = await this.checkCommandLimit(userId, commandName);
        if (!commandCheck.allowed) {
            return {
                allowed: false,
                type: 'command',
                resetTime: commandCheck.resetTime,
                message: `Command rate limit exceeded. Try again ${this.formatTimeRemaining(commandCheck.resetTime)}.`,
            };
        }

        return { allowed: true };
    }

    formatTimeRemaining(resetTime) {
        const remaining = Math.ceil((resetTime - Date.now()) / 1000);
        if (remaining < 60) {
            return `in ${remaining} seconds`;
        }
        return `in ${Math.ceil(remaining / 60)} minutes`;
    }

    // Get rate limit status for monitoring
    async getStatus() {
        const status = {};
        for (const [name, limiter] of Object.entries(this.limiters)) {
            try {
                // For Redis limiter, we can't easily get status
                // For memory limiter, we could get some stats
                status[name] = {
                    type: this.isRedisAvailable ? 'redis' : 'memory',
                    available: true,
                };
            } catch (error) {
                status[name] = {
                    type: this.isRedisAvailable ? 'redis' : 'memory',
                    available: false,
                    error: error.message,
                };
            }
        }
        return status;
    }
}

function createRateLimitService(config, cacheService, logger) {
    const service = new RateLimitService(config, cacheService, logger);
    service.initialize();
    return service;
}

module.exports = { createRateLimitService };