const fs = require("fs");
const path = require("path");

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        if (error && error.code === "EPERM") {
            return true;
        }
        return false;
    }
}

function createSingleInstanceLockService({ botConfig, logger }) {
    const lockFile = path.join(botConfig.paths.storage.root, "bot.lock");

    function ensureStorageRoot() {
        if (!fs.existsSync(botConfig.paths.storage.root)) {
            fs.mkdirSync(botConfig.paths.storage.root, { recursive: true });
        }
    }

    async function acquireLock() {
        ensureStorageRoot();

        if (fs.existsSync(lockFile)) {
            try {
                const content = fs.readFileSync(lockFile, "utf8");
                const payload = JSON.parse(content);
                const existingPid = Number(payload.pid || payload.processId);

                if (existingPid && isProcessAlive(existingPid)) {
                    throw new Error(
                        `Another bot instance is already running (pid=${existingPid}). Stop the other instance before starting a new one.`
                    );
                }

                logger.warn("[LOCK] stale lock file detected, removing stale lock", {
                    path: lockFile,
                    stalePid: existingPid,
                });
                fs.unlinkSync(lockFile);
            } catch (error) {
                if (error instanceof SyntaxError) {
                    logger.warn("[LOCK] invalid lock file content, removing stale lock", {
                        path: lockFile,
                    });
                    fs.unlinkSync(lockFile);
                } else if (error.message.includes("Another bot instance")) {
                    throw error;
                } else {
                    logger.warn("[LOCK] could not read existing lock file, removing stale lock if present", {
                        path: lockFile,
                        error: error.message,
                    });
                    try {
                        fs.unlinkSync(lockFile);
                    } catch (_) {
                        // ignore cleanup errors
                    }
                }
            }
        }

        const lockPayload = {
            pid: process.pid,
            startedAt: new Date().toISOString(),
            argv: process.argv,
        };
        fs.writeFileSync(lockFile, JSON.stringify(lockPayload, null, 2), "utf8");
        logger.info("[LOCK] acquired single instance lock", { lockFile });
    }

    async function releaseLock() {
        try {
            if (fs.existsSync(lockFile)) {
                const content = fs.readFileSync(lockFile, "utf8");
                const payload = JSON.parse(content);
                const existingPid = Number(payload.pid || payload.processId);

                if (existingPid === process.pid) {
                    fs.unlinkSync(lockFile);
                    logger.info("[LOCK] released single instance lock", { lockFile });
                } else {
                    logger.warn("[LOCK] lock file belongs to a different process, not removing", {
                        lockFile,
                        ownerPid: existingPid,
                        currentPid: process.pid,
                    });
                }
            }
        } catch (error) {
            logger.warn("[LOCK] failed to release lock file", {
                lockFile,
                error: error.message,
            });
        }
    }

    return {
        lockFile,
        acquireLock,
        releaseLock,
    };
}

module.exports = {
    createSingleInstanceLockService,
};
