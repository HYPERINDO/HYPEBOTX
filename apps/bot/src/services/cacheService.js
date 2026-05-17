const { createClient } = require('redis');

class CacheService {
    constructor(config, logger) {
        this.config = config?.redis;

        this.logger = logger;

        this.client = null;
        this.isConnected = false;

        // Safe mode switches
        this.redisEnabled = String(process.env.REDIS_ENABLED ?? "true").toLowerCase() === "true";
        this.cacheProvider = String(process.env.CACHE_PROVIDER ?? "redis").toLowerCase();

        this.cacheDisabled = !this.redisEnabled || this.cacheProvider === "memory";

        // Throttle Redis error spam
        this.lastRedisErrorAtMs = 0;
        this.redisErrorCooldownMs = 60_000; // log at most once per minute
    }

    async connect() {
        if (this.cacheDisabled) {
            this.isConnected = false;
            this.logger?.info?.("[CACHE] Cache disabled (memory/no-op mode)");
            return;
        }

        if (!this.config?.host || !this.config?.port) {
            this.isConnected = false;
            this.logger?.warn?.("[CACHE] Redis config missing; cache disabled");
            return;
        }

        try {
            this.client = createClient({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                database: this.config.db,
            });

            this.client.on("error", (err) => {
                this.isConnected = false;

                const now = Date.now();
                if (now - this.lastRedisErrorAtMs >= this.redisErrorCooldownMs) {
                    this.lastRedisErrorAtMs = now;
                    this.logger?.warn?.("[CACHE] Redis unavailable, running without cache", {
                        code: err?.code,
                    });
                }
            });

            this.client.on("connect", () => {
                this.isConnected = true;
                this.logger?.info?.("[CACHE] Connected to Redis");
            });

            this.client.on("ready", () => {
                this.logger?.info?.("[CACHE] Redis client ready");
            });

            this.client.on("end", () => {
                this.isConnected = false;
                this.logger?.warn?.("[CACHE] Redis connection ended");
            });

            await this.client.connect();
        } catch (error) {
            this.isConnected = false;
            this.logger?.warn?.("[CACHE] Failed to connect to Redis; running without cache", {
                code: error?.code,
            });
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.disconnect();
        }
    }

    async get(key) {
        if (!this.isConnected) return null;
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            this.logger.error(`[CACHE] Error getting key ${key}:`, error);
            return null;
        }
    }

    async set(key, value, ttl = null) {
        if (!this.isConnected) return false;
        try {
            const serialized = JSON.stringify(value);
            if (ttl) {
                await this.client.setEx(key, ttl, serialized);
            } else {
                await this.client.set(key, serialized);
            }
            return true;
        } catch (error) {
            this.logger.error(`[CACHE] Error setting key ${key}:`, error);
            return false;
        }
    }

    async del(key) {
        if (!this.isConnected) return false;
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            this.logger.error(`[CACHE] Error deleting key ${key}:`, error);
            return false;
        }
    }

    async exists(key) {
        if (!this.isConnected) return false;
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            this.logger.error(`[CACHE] Error checking key ${key}:`, error);
            return false;
        }
    }

    // User-specific cache methods
    getUserCacheKey(userId, type = 'data') {
        return `user:${userId}:${type}`;
    }

    async getUserData(userId) {
        return this.get(this.getUserCacheKey(userId, 'data'));
    }

    async setUserData(userId, data) {
        return this.set(this.getUserCacheKey(userId, 'data'), data, this.config.ttl.userCache);
    }

    // Guild-specific cache methods
    getGuildCacheKey(guildId, type = 'config') {
        return `guild:${guildId}:${type}`;
    }

    async getGuildConfig(guildId) {
        return this.get(this.getGuildCacheKey(guildId, 'config'));
    }

    async setGuildConfig(guildId, config) {
        return this.set(this.getGuildCacheKey(guildId, 'config'), config, this.config.ttl.guildCache);
    }

    // Command cache for rate limiting
    getCommandCacheKey(userId, command) {
        return `cmd:${userId}:${command}`;
    }

    async getCommandUsage(userId, command) {
        return this.get(this.getCommandCacheKey(userId, command));
    }

    async setCommandUsage(userId, command, data, ttl) {
        return this.set(this.getCommandCacheKey(userId, command), data, ttl);
    }
}

function createCacheService(config, logger) {
    return new CacheService(config, logger);
}

module.exports = { createCacheService };
