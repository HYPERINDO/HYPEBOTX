const os = require("os");
const fs = require("fs");
const path = require("path");
const v8 = require("v8");
const { createLogger } = require("../utils/logger");

/**
 * Enhanced Crash Detection and Recovery Service
 * Monitors bot health and handles crashes with alerts and recovery
 */
function createCrashDetectionService({ botConfig, logger, client, loggingService }) {
    const log = logger || createLogger("crashDetection");
    const config = botConfig.monitoring || {};

    const metrics = {
        startTime: Date.now(),
        crashes: [],
        errors: [],
        lastHeartbeat: Date.now(),
        commandExecutions: 0,
        failedCommands: 0,
        memoryUsage: [],
        cpuUsage: [],
        heapTrendSamples: [],
    };

    const ALERT_THRESHOLD = config.alertThreshold || 0.8; // legacy
    const RECOVERY_INTERVAL = config.recoveryInterval || 30000; // Check every 30s
    const ERROR_RATE_WINDOW = config.errorRateWindow || 5 * 60 * 1000; // 5 minutes

    // Anti-spam + state-change controls
    const parseBoolEnv = (value, defaultValue) => {
        if (value === undefined || value === null) return defaultValue;
        return ["true", "1", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
    };
    const parseNumberEnv = (value, defaultValue) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : defaultValue;
    };

    const HEALTH_ALERT_ENABLED = parseBoolEnv(process.env.HEALTH_ALERT_ENABLED, true);

    // Console health alert controls
    // IMPORTANT: default OFF to prevent any [HEALTH] console spam when env is missing/misread.
    const HEALTH_CONSOLE_ALERT_ENABLED = parseBoolEnv(process.env.HEALTH_CONSOLE_ALERT_ENABLED, false);

    // Optional single env (per request)
    // If set, critical uses this value (default 10m), warning uses 3x of it (default 30m).
    const HEALTH_ALERT_CONSOLE_COOLDOWN_MS_BASE = process.env.HEALTH_ALERT_CONSOLE_COOLDOWN_MS
        ? Number(process.env.HEALTH_ALERT_CONSOLE_COOLDOWN_MS)
        : null;

    // Critical log max 1x per 10 minutes
    const HEALTH_ALERT_CONSOLE_CRITICAL_COOLDOWN_MS = Number(
        HEALTH_ALERT_CONSOLE_COOLDOWN_MS_BASE ?? 600000,
    );

    // Warning log max 1x per 30 minutes
    const HEALTH_ALERT_CONSOLE_WARNING_COOLDOWN_MS = Number(
        process.env.HEALTH_ALERT_CONSOLE_WARNING_COOLDOWN_MS ??
        (HEALTH_ALERT_CONSOLE_COOLDOWN_MS_BASE ? HEALTH_ALERT_CONSOLE_COOLDOWN_MS_BASE * 3 : 1800000),
    );

    const HEALTH_ALERT_COOLDOWN_MS = Number(
        process.env.HEALTH_ALERT_COOLDOWN_MS ?? 600000, // legacy (used for discord/other fallback)
    );

    const HEALTH_WARNING_COOLDOWN_MS = Number(
        process.env.HEALTH_WARNING_COOLDOWN_MS ?? HEALTH_ALERT_COOLDOWN_MS,
    );

    const healthAlertStateChangeOnlyEnv =
        process.env.HEALTH_ALERT_STATE_CHANGE_ONLY ?? process.env.HEALTH_ALERT_ON_STATE_CHANGE_ONLY;
    const HEALTH_ALERT_STATE_CHANGE_ONLY =
        String(healthAlertStateChangeOnlyEnv ?? "true").toLowerCase() === "true";

    const HEALTH_ALERT_SEND_TO_DISCORD =
        String(process.env.HEALTH_ALERT_SEND_TO_DISCORD ?? "false").toLowerCase() === "true";
    const HEALTH_ALERT_RECOVERY_ENABLED = parseBoolEnv(process.env.HEALTH_ALERT_RECOVERY_ENABLED, true);

    // Prefer env thresholds for memory
    const HEALTH_MEMORY_WARNING_PERCENT = parseNumberEnv(process.env.HEALTH_MEMORY_WARNING_PERCENT, 85);
    const HEALTH_MEMORY_WARNING_MB = parseNumberEnv(process.env.HEALTH_MEMORY_WARNING_MB, 256);
    const HEALTH_MEMORY_CRITICAL_PERCENT = parseNumberEnv(process.env.HEALTH_MEMORY_CRITICAL_PERCENT, 90);
    const HEALTH_MEMORY_CRITICAL_MB = parseNumberEnv(process.env.HEALTH_MEMORY_CRITICAL_MB, 512);
    const HEALTH_MEMORY_EMERGENCY_GC_PERCENT = parseNumberEnv(process.env.HEALTH_MEMORY_EMERGENCY_GC_PERCENT, 95);
    const HEALTH_MEMORY_EMERGENCY_GC_MB = parseNumberEnv(process.env.HEALTH_MEMORY_EMERGENCY_GC_MB, 700);
    const HEALTH_MEMORY_EMERGENCY_GC_COOLDOWN_MS = parseNumberEnv(
        process.env.HEALTH_MEMORY_EMERGENCY_GC_COOLDOWN_MS,
        300000,
    );
    const HEALTH_HEAPDUMP_ENABLED = parseBoolEnv(process.env.HEALTH_HEAPDUMP_ENABLED, false);
    const HEALTH_HEAPDUMP_PATH = process.env.HEALTH_HEAPDUMP_PATH || path.join(process.cwd(), "logs", "heapdumps");
    const HEALTH_TREND_LOG_ENABLED = parseBoolEnv(process.env.HEALTH_TREND_LOG_ENABLED, true);
    const HEALTH_TREND_LOG_INTERVAL_MS = Number(process.env.HEALTH_TREND_LOG_INTERVAL_MS ?? 300000);
    const HEALTH_HISTORICAL_SAMPLE_COUNT = Number(process.env.HEALTH_HISTORICAL_SAMPLE_COUNT ?? 30);
    const HEALTH_CRASH_DETECTION_LOG_DETAILS =
        String(process.env.HEALTH_CRASH_DETECTION_LOG_DETAILS ?? "false").toLowerCase() === "true";

    // Track previous state + last sent timestamps
    const stateCache = {
        // memory hysteresis state: "ok" | "warning" | "critical"
        memoryLevel: "ok",
        // only send RECOVERY after we have observed unhealthy state in this runtime
        hasObservedUnhealthy: false,
        // signature based on alert TYPE, not severity
        lastHealthSignature: null, // e.g. "HIGH_MEMORY" | "ok"
        lastSentTsByType: new Map(), // type -> timestamp
        lastGcAt: 0,
        lastHeapdumpAt: 0,
        lastTrendLogAt: 0,
    };

    let currentPhase = "unknown";
    const validPhases = new Set(["startup", "idle", "ticket", "order", "check-order", "music", "unknown"]);

    /**
     * Record command execution
     */
    function recordCommandExecution(success = true) {
        metrics.commandExecutions++;
        if (!success) {
            metrics.failedCommands++;
        }
    }

    /**
     * Record error
     */
    function recordError(error, context = {}) {
        metrics.errors.push({
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            context,
        });

        // Keep only last 1000 errors
        if (metrics.errors.length > 1000) {
            metrics.errors.shift();
        }
    }

    /**
     * Record crash
     */
    function recordCrash(error, context = {}) {
        const crash = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            context,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
        };

        metrics.crashes.push(crash);
        log.error("[CRASH] Bot crash detected", crash);

        return crash;
    }

    /**
     * Update heartbeat
     */
    function updateHeartbeat() {
        metrics.lastHeartbeat = Date.now();
    }

    /**
     * Get memory usage percentage (process heap based)
     * Use heapUsed/heapTotal to avoid host/system RAM noise.
     */
    function getMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        return {
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            rss: memoryUsage.rss,
            external: memoryUsage.external,
            arrayBuffers: memoryUsage.arrayBuffers,
        };
    }

    function getHeapUsagePercentage(memoryUsage = getMemoryUsage()) {
        const used = memoryUsage.heapUsed;
        const total = memoryUsage.heapTotal || used;
        if (total <= 0) return 0;
        return (used / total) * 100;
    }

    /**
     * Get RSS percentage relative to heapTotal (best-effort proxy).
     */
    function getRssProxyPercentage(memoryUsage = getMemoryUsage()) {
        const rss = memoryUsage.rss;
        const total = memoryUsage.heapTotal || 0;
        if (!total) return 0;
        return (rss / total) * 100;
    }

    function formatMb(bytes) {
        return Number((bytes / 1024 / 1024).toFixed(2));
    }

    function getMemorySnapshot(memoryUsage = getMemoryUsage()) {
        return {
            heapUsedMb: formatMb(memoryUsage.heapUsed),
            heapTotalMb: formatMb(memoryUsage.heapTotal),
            rssMb: formatMb(memoryUsage.rss),
            externalMb: formatMb(memoryUsage.external),
            arrayBuffersMb: formatMb(memoryUsage.arrayBuffers),
            heapUsedPercent: Number(getHeapUsagePercentage(memoryUsage).toFixed(2)),
            rssProxyPercent: Number(getRssProxyPercentage(memoryUsage).toFixed(2)),
            uptimeSec: Math.round(process.uptime()),
        };
    }

    function evaluateMemoryPressure(memorySnapshot) {
        const shouldWarn =
            memorySnapshot.heapUsedPercent >= HEALTH_MEMORY_WARNING_PERCENT &&
            memorySnapshot.heapUsedMb >= HEALTH_MEMORY_WARNING_MB;
        const shouldCritical =
            memorySnapshot.heapUsedPercent >= HEALTH_MEMORY_CRITICAL_PERCENT &&
            memorySnapshot.heapUsedMb >= HEALTH_MEMORY_CRITICAL_MB;
        const shouldEmergency =
            memorySnapshot.heapUsedPercent >= HEALTH_MEMORY_EMERGENCY_GC_PERCENT &&
            memorySnapshot.heapUsedMb >= HEALTH_MEMORY_EMERGENCY_GC_MB;

        let status = "ok";
        if (shouldCritical || shouldEmergency) {
            status = "critical";
        } else if (shouldWarn) {
            status = "warning";
        }

        return {
            shouldWarn,
            shouldCritical,
            shouldEmergency,
            status,
        };
    }

    function recordHeapTrendSample(memorySnapshot) {
        const sample = {
            ts: Date.now(),
            heapUsedMb: memorySnapshot.heapUsedMb,
            rssMb: memorySnapshot.rssMb,
            externalMb: memorySnapshot.externalMb,
            arrayBuffersMb: memorySnapshot.arrayBuffersMb,
        };

        metrics.heapTrendSamples.push(sample);
        if (metrics.heapTrendSamples.length > HEALTH_HISTORICAL_SAMPLE_COUNT) {
            metrics.heapTrendSamples.shift();
        }
    }

    function getHeapTrendSummary() {
        const samples = metrics.heapTrendSamples;
        if (samples.length < 2) {
            return null;
        }

        const first = samples[0];
        const last = samples[samples.length - 1];
        const windowSec = Math.round((last.ts - first.ts) / 1000);
        const heapDeltaMb = Number((last.heapUsedMb - first.heapUsedMb).toFixed(2));
        const heapDeltaPercent = Number(((last.heapUsedMb - first.heapUsedMb) / Math.max(first.heapUsedMb, 1) * 100).toFixed(2));

        return {
            phase: currentPhase,
            heapUsedMb: last.heapUsedMb,
            heapDeltaMb,
            heapDeltaPercent,
            rssMb: last.rssMb,
            rssDeltaMb: Number((last.rssMb - first.rssMb).toFixed(2)),
            externalMb: last.externalMb,
            arrayBuffersMb: last.arrayBuffersMb,
            uptimeSec: Math.round(process.uptime()),
            sampleCount: samples.length,
            trendWindowSec: windowSec,
            suspectedLeak: heapDeltaMb > 50 && heapDeltaPercent > 10,
        };
    }

    function maybeLogHeapTrend(memorySnapshot) {
        if (!HEALTH_TREND_LOG_ENABLED) return;

        recordHeapTrendSample(memorySnapshot);
        const now = Date.now();
        if (now - stateCache.lastTrendLogAt < HEALTH_TREND_LOG_INTERVAL_MS) {
            return;
        }

        const trend = getHeapTrendSummary();
        if (!trend) return;

        stateCache.lastTrendLogAt = now;
        log.info("heap leak trend", trend);
    }

    function createHeapdumpDirectory() {
        try {
            if (!fs.existsSync(HEALTH_HEAPDUMP_PATH)) {
                fs.mkdirSync(HEALTH_HEAPDUMP_PATH, { recursive: true });
            }
        } catch (error) {
            log.warn("[CRASH DETECTION] Failed to create heapdump directory", { path: HEALTH_HEAPDUMP_PATH, error: error.message });
        }
    }

    function writeHeapdump() {
        if (!HEALTH_HEAPDUMP_ENABLED) return null;
        if (typeof v8.writeHeapSnapshot !== "function") {
            log.warn("[CRASH DETECTION] Heapdump unavailable: v8.writeHeapSnapshot not supported");
            return null;
        }

        createHeapdumpDirectory();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17);
        const filename = path.join(HEALTH_HEAPDUMP_PATH, `heapdump-${timestamp}.heapsnapshot`);
        try {
            const result = v8.writeHeapSnapshot(filename);
            log.warn("[CRASH DETECTION] Heapdump written", { filename, result });
            return filename;
        } catch (error) {
            log.error("[CRASH DETECTION] Failed to write heapdump", { error: error.message });
            return null;
        }
    }

    function performEmergencyGC(memorySnapshot) {
        const currentUsagePercent = memorySnapshot.heapUsedPercent;
        const currentUsageMb = memorySnapshot.heapUsedMb;

        if (typeof global.gc !== "function") {
            log.warn("[CRASH DETECTION] Emergency GC requested but --expose-gc is not enabled");
            return false;
        }

        const now = Date.now();
        if (now - stateCache.lastGcAt < HEALTH_MEMORY_EMERGENCY_GC_COOLDOWN_MS) {
            return false;
        }

        stateCache.lastGcAt = now;
        const before = getMemoryUsage();
        log.warn("[CRASH DETECTION] Performing emergency GC", {
            heapUsedMb: formatMb(before.heapUsed),
            heapTotalMb: formatMb(before.heapTotal),
            rssMb: formatMb(before.rss),
        });
        global.gc();
        const after = getMemoryUsage();
        const deltaMb = formatMb(before.heapUsed - after.heapUsed);
        log.warn("[CRASH DETECTION] Emergency GC completed", {
            heapUsedMb: formatMb(after.heapUsed),
            heapTotalMb: formatMb(after.heapTotal),
            rssMb: formatMb(after.rss),
            freedMb: deltaMb,
        });

        if (
            HEALTH_HEAPDUMP_ENABLED &&
            currentUsagePercent >= HEALTH_MEMORY_CRITICAL_PERCENT &&
            currentUsageMb >= HEALTH_MEMORY_CRITICAL_MB
        ) {
            const heapdumpFile = writeHeapdump();
            if (heapdumpFile) {
                stateCache.lastHeapdumpAt = Date.now();
            }
        }

        return true;
    }

    /**
     * Get CPU usage percentage
     */
    function getCpuUsagePercentage() {
        // This is a rough proxy (host loadavg). Keep legacy but don't trigger memory critical from it.
        const cpus = os.cpus();
        if (!cpus || cpus.length === 0) return 0;

        const avgLoad = os.loadavg()[0];
        const numCpus = cpus.length;
        return (avgLoad / numCpus) * 100;
    }

    /**
     * Get error rate
     */
    function getErrorRate() {
        const recentErrors = metrics.errors.filter(e => {
            const age = Date.now() - new Date(e.timestamp).getTime();
            return age < ERROR_RATE_WINDOW;
        });

        if (metrics.commandExecutions === 0) {
            return 0;
        }

        return recentErrors.length / metrics.commandExecutions;
    }

    /**
     * Check bot health
     */
    async function checkBotHealth() {
        const memoryUsage = getMemoryUsage();
        const heapUsedPercent = getHeapUsagePercentage(memoryUsage);
        const rssProxyPercent = getRssProxyPercentage(memoryUsage);
        const cpuUsage = getCpuUsagePercentage();
        const errorRate = getErrorRate();
        const heartbeatAge = Date.now() - metrics.lastHeartbeat;

        const memorySnapshot = getMemorySnapshot(memoryUsage);
        const memoryPressure = evaluateMemoryPressure(memorySnapshot);

        metrics.memoryUsage.push({
            timestamp: Date.now(),
            percentage: heapUsedPercent,
            rssProxyPercentage: rssProxyPercent,
            heapUsedMb: memorySnapshot.heapUsedMb,
            heapTotalMb: memorySnapshot.heapTotalMb,
            rssMb: memorySnapshot.rssMb,
            externalMb: memorySnapshot.externalMb,
            arrayBuffersMb: memorySnapshot.arrayBuffersMb,
        });

        maybeLogHeapTrend(memorySnapshot);

        metrics.cpuUsage.push({
            timestamp: Date.now(),
            percentage: cpuUsage,
        });

        // Keep only last 100 readings
        if (metrics.memoryUsage.length > 100) metrics.memoryUsage.shift();
        if (metrics.cpuUsage.length > 100) metrics.cpuUsage.shift();

        const health = {
            healthy: true,
            checks: {},
            alerts: [],
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
        };

        // Memory checks (process-based)
        health.checks.memory = {
            status: memoryPressure.status,
            value: heapUsedPercent.toFixed(2),
            unit: "%",
            rssProxyValue: rssProxyPercent.toFixed(2),
            rssProxyUnit: "%",
            heapUsedMb: formatMb(memoryUsage.heapUsed),
            heapTotalMb: formatMb(memoryUsage.heapTotal),
            rssMb: formatMb(memoryUsage.rss),
            externalMb: formatMb(memoryUsage.external),
            arrayBuffersMb: formatMb(memoryUsage.arrayBuffers),
            uptimeSec: Math.floor(process.uptime()),
            threshold: {
                warning: { percent: HEALTH_MEMORY_WARNING_PERCENT, heapUsedMb: HEALTH_MEMORY_WARNING_MB },
                critical: { percent: HEALTH_MEMORY_CRITICAL_PERCENT, heapUsedMb: HEALTH_MEMORY_CRITICAL_MB },
                emergency: { percent: HEALTH_MEMORY_EMERGENCY_GC_PERCENT, heapUsedMb: HEALTH_MEMORY_EMERGENCY_GC_MB },
            },
        };

        if (memoryPressure.shouldCritical) {
            health.healthy = false;
            log.warn("[HEALTH] memory snapshot", memorySnapshot);
            health.alerts.push({
                type: "HIGH_MEMORY",
                severity: "critical",
                message: `Heap memory usage is at ${heapUsedPercent.toFixed(2)}% (${memorySnapshot.heapUsedMb}MB)`,
                details: memorySnapshot,
            });
        } else if (memoryPressure.shouldWarn) {
            health.healthy = false;
            log.warn("[HEALTH] memory snapshot", memorySnapshot);
            health.alerts.push({
                type: "HIGH_MEMORY",
                severity: "warning",
                message: `Heap memory usage is at ${heapUsedPercent.toFixed(2)}% (${memorySnapshot.heapUsedMb}MB)`,
                details: memorySnapshot,
            });
        }

        // CPU check (warning only)
        if (cpuUsage > ALERT_THRESHOLD * 100) {
            health.healthy = false;
            health.alerts.push({
                type: "HIGH_CPU",
                severity: "warning",
                message: `CPU usage is at ${cpuUsage.toFixed(2)}%`,
            });
        }
        health.checks.cpu = {
            status: cpuUsage > ALERT_THRESHOLD * 100 ? "warning" : "ok",
            value: cpuUsage.toFixed(2),
            unit: "%",
        };

        // Error rate check (warning only)
        if (errorRate > 0.1) {
            health.healthy = false;
            health.alerts.push({
                type: "HIGH_ERROR_RATE",
                severity: "warning",
                message: `Error rate is ${(errorRate * 100).toFixed(2)}%`,
            });
        }
        health.checks.errorRate = {
            status: errorRate > 0.1 ? "warning" : "ok",
            value: (errorRate * 100).toFixed(2),
            unit: "%",
        };

        // Heartbeat check
        if (heartbeatAge > 60000) {
            health.healthy = false;
            health.alerts.push({
                type: "NO_HEARTBEAT",
                severity: "critical",
                message: `No heartbeat for ${(heartbeatAge / 1000).toFixed(0)} seconds`,
            });
        }

        if (memoryPressure.shouldEmergency) {
            const gcPerformed = performEmergencyGC(memorySnapshot);
            if (gcPerformed) {
                health.alerts.push({
                    type: "EMERGENCY_GC",
                    severity: "info",
                    message: `Emergency GC triggered at ${heapUsedPercent.toFixed(2)}% heap (${memorySnapshot.heapUsedMb}MB)`,
                });
            }
        }
        health.checks.heartbeat = {
            status: heartbeatAge > 60000 ? "critical" : "ok",
            value: (heartbeatAge / 1000).toFixed(0),
            unit: "s",
        };

        // Discord connection check
        if (client && client.isReady && client.isReady()) {
            health.checks.discord = { status: "ok", value: "Connected" };
        } else {
            health.healthy = false;
            health.checks.discord = { status: "critical", value: "Disconnected" };
            health.alerts.push({
                type: "DISCORD_DISCONNECTED",
                severity: "critical",
                message: "Bot is not connected to Discord",
            });
        }

        return health;
    }

    // signature based on alert TYPE (not severity) to prevent HIGH_MEMORY critical<->warning flip spam
    function getAlertTypeSignature(health) {
        if (!health.alerts || health.alerts.length === 0) return "ok";

        // Recovery must NOT map to "ok" to avoid "[HEALTH] ok warning" spam
        const hasRecovery = health.alerts.some(a => a.type === "RECOVERY");
        if (hasRecovery) return "RECOVERY";

        // Prefer memory signals first
        const hasHighMemory = health.alerts.some(a => a.type === "HIGH_MEMORY");
        if (hasHighMemory) return "HIGH_MEMORY";

        // Otherwise pick first alert type
        const first = health.alerts[0];
        if (first?.type) return String(first.type);

        return "unknown";
    }

    /**
     * Send health alert (anti-spam)
     */
    async function sendHealthAlert(health) {
        if (!HEALTH_ALERT_ENABLED) return;
        if (!health.alerts || health.alerts.length === 0) return;

        // signature based on alert TYPE, not severity
        const signature = getAlertTypeSignature(health); // e.g. "HIGH_MEMORY" | "ok"
        const now = Date.now();

        // Optional: disable "Health recovered" notifications entirely while
        // keeping warning/critical health alerts active.
        if (signature === "RECOVERY" && !HEALTH_ALERT_RECOVERY_ENABLED) {
            return;
        }

        const lastSignature = stateCache.lastHealthSignature;
        const signatureChanged = lastSignature !== signature;

        // Recovery/healthy guard:
        // - "ok" should log only on transition into healthy state
        if (signature === "ok" && !signatureChanged) {
            return;
        }

        // State-change only mode (legacy behavior)
        if (HEALTH_ALERT_STATE_CHANGE_ONLY && !signatureChanged) {
            return;
        }

        // Cooldown per alert TYPE (and severity for console rules)
        const alertType = signature; // "HIGH_MEMORY" | other types
        const critical = health.alerts.some(a => a.severity === "critical");
        const hasInfoSeverity = health.alerts.some(a => String(a.severity).toLowerCase() === "info");
        const severityLabel = critical ? "critical" : hasInfoSeverity ? "info" : "warning";

        const currentCooldown =
            severityLabel === "warning"
                ? HEALTH_ALERT_CONSOLE_WARNING_COOLDOWN_MS
                : HEALTH_ALERT_CONSOLE_CRITICAL_COOLDOWN_MS;

        const prevTs = stateCache.lastSentTsByType.get(alertType);
        if (typeof prevTs === "number" && now - prevTs < currentCooldown) {
            return;
        }

        // Update caches first to avoid tight loops
        stateCache.lastHealthSignature = signature;
        stateCache.lastSentTsByType.set(alertType, now);

        if (HEALTH_CONSOLE_ALERT_ENABLED) {
            // Concise runtime log only (no JSON dump)
            // Example: WARN [HEALTH] HIGH_MEMORY critical heap=95.07%
            const memAlert = health.alerts.find(a => a.type === "HIGH_MEMORY");
            const heapVal = memAlert?.message?.match(/(\d+(\.\d+)?)/)?.[1];
            const heapSuffix = heapVal ? ` heap=${heapVal}%` : "";
            const memorySnapshot = getMemorySnapshot();

            log.warn(`[HEALTH] ${alertType} ${severityLabel}${heapSuffix}`, memorySnapshot);
        }

        if (HEALTH_ALERT_SEND_TO_DISCORD && loggingService && typeof loggingService.logAlert === "function") {
            try {
                const alertPayload = {
                    type: "HEALTH_CHECK",
                    severity: severityLabel,
                    message: `Bot Health Alert: ${alertType} ${severityLabel}`,
                    suppressConsoleLog: true,
                };

                if (HEALTH_CRASH_DETECTION_LOG_DETAILS) {
                    alertPayload.details = health;
                }

                await loggingService.logAlert(alertPayload);
            } catch (error) {
                log.error("[CRASH DETECTION] Failed to send alert", { error: error.message });
            }
            return;
        }

        // Fallback: log to error channel if available
        if (loggingService) {
            try {
                if (typeof loggingService.logError === "function") {
                    await loggingService.logError(null, "HEALTH_CHECK", `Bot Health Alert: ${health.alerts.map(a => a.message).join("; ")}`);
                } else {
                    log.warn("[CRASH DETECTION] loggingService.logAlert not available");
                }
            } catch (e) {
                log.warn("[CRASH DETECTION] Failed to fallback-send alert", { error: e?.message || String(e) });
            }
        }
    }

    /**
     * Get crash recovery recommendations
     */
    function getRecoveryRecommendations() {
        const recommendations = [];

        const lastCrash = metrics.crashes[metrics.crashes.length - 1];
        if (lastCrash) {
            if (lastCrash.message.includes("ENOTFOUND")) {
                recommendations.push("Check network connectivity");
            }
            if (lastCrash.message.includes("EACCES")) {
                recommendations.push("Check file permissions");
            }
            if (lastCrash.message.includes("Out of memory")) {
                recommendations.push("Increase available memory or optimize memory usage");
            }
        }

        const memorySnapshot = getMemorySnapshot();
        if (
            memorySnapshot.heapUsedPercent >= HEALTH_MEMORY_CRITICAL_PERCENT &&
            memorySnapshot.heapUsedMb >= HEALTH_MEMORY_CRITICAL_MB
        ) {
            recommendations.push("Garbage collection recommended - heap usage is critical");
        }

        return recommendations;
    }

    /**
     * Perform graceful shutdown
     */
    async function gracefulShutdown(reason = "Unknown") {
        log.warn("[CRASH DETECTION] Initiating graceful shutdown", { reason });

        try {
            if (client && client.destroy) {
                await client.destroy();
            }
        } catch (error) {
            log.error("[CRASH DETECTION] Error during shutdown", { error: error.message });
        }

        process.exit(1);
    }

    /**
     * Start monitoring
     */
    function startMonitoring() {
        log.info("[CRASH DETECTION] Starting crash detection monitoring");

        // Health check every interval
        setInterval(async () => {
            try {
                const health = await checkBotHealth();
                if (!health.healthy) {
                    stateCache.hasObservedUnhealthy = true;
                    await sendHealthAlert(health);
                } else {
                    // Only emit RECOVERY when this runtime has previously seen unhealthy state.
                    // This prevents startup/restart healthy state from spamming "Health recovered".
                    if (stateCache.hasObservedUnhealthy && HEALTH_ALERT_RECOVERY_ENABLED) {
                        await sendHealthAlert({
                            ...health,
                            alerts: [{ type: "RECOVERY", severity: "info", message: "Health recovered" }],
                            healthy: true,
                        });
                    }
                    stateCache.hasObservedUnhealthy = false;
                }
            } catch (error) {
                log.error("[CRASH DETECTION] Health check failed", { error: error.message });
            }
        }, RECOVERY_INTERVAL);

        // Warn if GC is not exposed in runtime
        if (typeof global.gc !== "function") {
            log.warn("[CRASH DETECTION] --expose-gc is not enabled. Emergency GC will not run.");
        }

        // Update heartbeat periodically
        setInterval(() => {
            updateHeartbeat();
        }, 10000); // Every 10 seconds
    }

    /**
     * Get metrics summary
     */
    function getMetricsSummary() {
        return {
            startTime: new Date(metrics.startTime).toISOString(),
            uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
            crashes: metrics.crashes.length,
            errors: metrics.errors.length,
            commandExecutions: metrics.commandExecutions,
            failedCommands: metrics.failedCommands,
            errorRate: (getErrorRate() * 100).toFixed(2),
            memoryUsage: getHeapUsagePercentage().toFixed(2),
            cpuUsage: getCpuUsagePercentage().toFixed(2),
            lastHeartbeat: new Date(metrics.lastHeartbeat).toISOString(),
            averageMemoryUsage: metrics.memoryUsage.length > 0
                ? (metrics.memoryUsage.reduce((a, b) => a + b.percentage, 0) / metrics.memoryUsage.length).toFixed(2)
                : 0,
        };
    }

    return {
        recordCommandExecution,
        recordError,
        recordCrash,
        updateHeartbeat,
        setPhase(phase) {
            currentPhase = validPhases.has(phase) ? phase : "unknown";
        },
        checkBotHealth,
        sendHealthAlert,
        getRecoveryRecommendations,
        gracefulShutdown,
        startMonitoring,
        getMetricsSummary,
        getMemoryUsagePercentage: getHeapUsagePercentage,
        getCpuUsagePercentage,
        getErrorRate,
    };
}

module.exports = { createCrashDetectionService };
