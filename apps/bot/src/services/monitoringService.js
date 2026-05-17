const express = require('express');
const compression = require('compression');
const helmet = require('helmet');

class MonitoringService {
    constructor(config, logger) {
        this.config = config.monitoring;
        this.logger = logger;
        this.app = null;
        this.server = null;
        this.metrics = {
            startTime: Date.now(),
            requests: 0,
            errors: 0,
            commands: 0,
            aiRequests: 0,
        };
        this.recentErrors = [];
        this.maxRecentErrors = 50;
    }

    start() {
        if (!this.config.enabled) {
            this.logger.info('[MONITORING] Monitoring disabled');
            return;
        }

        this.app = express();

        // Security and performance middleware
        this.app.use(helmet({
            contentSecurityPolicy: false, // Disable CSP for API endpoints
        }));
        this.app.use(compression());

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            this.incrementRequests();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: Math.floor((Date.now() - this.metrics.startTime) / 1000),
                memory: process.memoryUsage(),
                version: process.version,
            });
        });

        // Metrics endpoint
        this.app.get('/metrics', (req, res) => {
            this.incrementRequests();
            res.json({
                ...this.metrics,
                recentErrors: this.recentErrors.length,
                timestamp: new Date().toISOString(),
                uptime: Math.floor((Date.now() - this.metrics.startTime) / 1000),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
            });
        });

        // Readiness check
        this.app.get('/ready', (req, res) => {
            this.incrementRequests();
            res.json({
                status: 'ready',
                timestamp: new Date().toISOString(),
            });
        });

        // Error report endpoint
        this.app.get('/errors', (req, res) => {
            this.incrementRequests();
            res.json({
                count: this.metrics.errors,
                recent: this.recentErrors,
                timestamp: new Date().toISOString(),
            });
        });

        // Start server
        this.server = this.app.listen(this.config.port, () => {
            this.logger.info(`[MONITORING] Server listening on port ${this.config.port}`);
        });

        this.server.on('error', (error) => {
            this.logger.error('[MONITORING] Server error:', error);
        });
    }

    stop() {
        if (this.server) {
            this.server.close(() => {
                this.logger.info('[MONITORING] Server stopped');
            });
        }
    }

    // Metrics tracking methods
    incrementRequests() {
        this.metrics.requests++;
    }

    incrementErrors() {
        this.metrics.errors++;
    }

    captureError(error, metadata = {}) {
        this.incrementErrors();

        const entry = {
            timestamp: new Date().toISOString(),
            message: error?.message || String(error) || 'Unknown error',
            stack: error?.stack || null,
            ...metadata,
        };

        this.recentErrors.unshift(entry);
        if (this.recentErrors.length > this.maxRecentErrors) {
            this.recentErrors.pop();
        }

        if (typeof this.logger?.error === 'function') {
            this.logger.error('[MONITORING] Captured error', entry);
        }

        return entry;
    }

    incrementCommands() {
        this.metrics.commands++;
    }

    incrementAIRequests() {
        this.metrics.aiRequests++;
    }

    // Performance monitoring
    recordCommandExecution(commandName, duration, success = true) {
        // Could store in a time-series database or just log
        const msg = `[METRICS] Command ${commandName} executed in ${duration}ms (${success ? 'success' : 'failed'})`;
        if (typeof this.logger?.debug === "function") this.logger.debug(msg);
        else if (typeof this.logger?.info === "function") this.logger.info(msg);
    }

    recordAIRequest(duration, success = true) {
        this.incrementAIRequests();
        const msg = `[METRICS] AI request completed in ${duration}ms (${success ? 'success' : 'failed'})`;
        if (typeof this.logger?.debug === "function") this.logger.debug(msg);
        else if (typeof this.logger?.info === "function") this.logger.info(msg);
    }
}

function createMonitoringService(config, logger) {
    return new MonitoringService(config, logger);
}

module.exports = { createMonitoringService };
