const fs = require("fs");
const path = require("path");
const { createLogger } = require("../utils/logger");

/**
 * JSON Corruption Recovery Service
 * Detects and recovers corrupted JSON files
 */
function createJsonRecoveryService({ botConfig, logger, enhancedBackupService }) {
    const log = logger || createLogger("jsonRecovery");
    const storageDir = botConfig.paths.storage.root;

    /**
     * Validate JSON file
     */
    function validateJsonFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return {
                    valid: false,
                    error: "File not found",
                };
            }

            const content = fs.readFileSync(filePath, "utf8");

            if (!content.trim()) {
                return {
                    valid: false,
                    error: "File is empty",
                };
            }

            JSON.parse(content);

            return {
                valid: true,
                size: content.length,
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
            };
        }
    }

    /**
     * Attempt to repair corrupted JSON
     */
    function attemptJsonRepair(content) {
        const repairs = [];

        let repaired = content;

        // Fix trailing commas
        repaired = repaired.replace(/,\s*([}\]])/g, (match, bracket) => {
            repairs.push("Removed trailing comma");
            return bracket;
        });

        // Fix missing closing brackets
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        if (openBraces > closeBraces) {
            repaired += "}".repeat(openBraces - closeBraces);
            repairs.push(`Added ${openBraces - closeBraces} missing closing braces`);
        }

        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
            repaired += "]".repeat(openBrackets - closeBrackets);
            repairs.push(`Added ${openBrackets - closeBrackets} missing closing brackets`);
        }

        // Fix unquoted keys
        repaired = repaired.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
        if (repaired !== content && repairs.length < 10) {
            repairs.push("Fixed unquoted keys");
        }

        // Fix single-quoted strings (convert to double quotes)
        repaired = repaired.replace(/'([^']*)'/g, '"$1"');
        if (repaired !== content && repairs.length < 10) {
            repairs.push("Converted single quotes to double quotes");
        }

        return {
            repaired,
            repairs,
        };
    }

    /**
     * Detect JSON corruption
     */
    function detectCorruption(filePath) {
        const validation = validateJsonFile(filePath);

        if (validation.valid) {
            return {
                corrupted: false,
                file: filePath,
            };
        }

        return {
            corrupted: true,
            file: filePath,
            error: validation.error,
            size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
        };
    }

    /**
     * Scan directory for corrupted JSON files
     */
    function scanForCorruption(dirPath = storageDir) {
        const corrupted = [];
        const backups = [];

        try {
            const files = fs.readdirSync(dirPath, { recursive: true });

            for (const file of files) {
                if (file.endsWith(".json")) {
                    const fullPath = path.join(dirPath, file);
                    const corruption = detectCorruption(fullPath);

                    if (corruption.corrupted) {
                        corrupted.push(corruption);
                    }
                } else if (file.endsWith(".gz") || file.endsWith(".backup")) {
                    backups.push(file);
                }
            }
        } catch (error) {
            log.error("[RECOVERY] Scan failed", { error: error.message });
        }

        return {
            timestamp: new Date().toISOString(),
            corrupted,
            backupsAvailable: backups.length,
        };
    }

    /**
     * Recover corrupted JSON file
     */
    async function recoverJsonFile(filePath, strategy = "repair") {
        try {
            log.info("[RECOVERY] Starting recovery", { filePath, strategy });

            const validation = validateJsonFile(filePath);

            if (validation.valid) {
                return {
                    success: true,
                    message: "File is not corrupted",
                    strategy: "none",
                };
            }

            // Strategy 1: Attempt repair
            if (strategy === "repair" || strategy === "all") {
                try {
                    const content = fs.readFileSync(filePath, "utf8");
                    const { repaired, repairs } = attemptJsonRepair(content);

                    // Validate repaired content
                    try {
                        JSON.parse(repaired);

                        // Create backup of corrupted file
                        const backupPath = `${filePath}.corrupted.${Date.now()}`;
                        fs.copyFileSync(filePath, backupPath);

                        // Write repaired content
                        fs.writeFileSync(filePath, repaired);

                        log.info("[RECOVERY] File repaired successfully", {
                            filePath,
                            repairs,
                            backupPath,
                        });

                        return {
                            success: true,
                            strategy: "repair",
                            repairs,
                            backupPath,
                        };
                    } catch (parseError) {
                        log.warn("[RECOVERY] Repair failed validation", { error: parseError.message });
                    }
                } catch (error) {
                    log.warn("[RECOVERY] Repair strategy failed", { error: error.message });
                }
            }

            // Strategy 2: Restore from backup
            if (strategy === "restore" || strategy === "all") {
                if (enhancedBackupService) {
                    try {
                        const backups = enhancedBackupService.listBackups();
                        if (backups.length > 0) {
                            // Use latest backup
                            const latestBackup = backups[0];
                            log.info("[RECOVERY] Restoring from backup", { backup: latestBackup.filename });

                            const result = await enhancedBackupService.restoreFromBackup(latestBackup.filename);

                            return {
                                success: result.success,
                                strategy: "restore",
                                backup: latestBackup.filename,
                                message: result.message || "Restored from backup",
                            };
                        }
                    } catch (error) {
                        log.warn("[RECOVERY] Restore strategy failed", { error: error.message });
                    }
                }
            }

            // Strategy 3: Delete corrupted file (last resort)
            if (strategy === "delete") {
                const backupPath = `${filePath}.corrupted.${Date.now()}`;
                fs.copyFileSync(filePath, backupPath);
                fs.unlinkSync(filePath);

                log.warn("[RECOVERY] Deleted corrupted file", { filePath, backupPath });

                return {
                    success: true,
                    strategy: "delete",
                    message: "Corrupted file deleted",
                    backupPath,
                };
            }

            return {
                success: false,
                message: "Could not recover file",
                error: validation.error,
            };
        } catch (error) {
            log.error("[RECOVERY] Recovery failed", { filePath, error: error.message });
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Batch recover corrupted files
     */
    async function recoverCorruptedFiles() {
        try {
            log.info("[RECOVERY] Starting batch recovery");

            const scan = scanForCorruption();

            if (scan.corrupted.length === 0) {
                return {
                    success: true,
                    message: "No corrupted files found",
                    scanned: scan,
                };
            }

            const results = [];

            for (const corruption of scan.corrupted) {
                try {
                    const result = await recoverJsonFile(corruption.file);
                    results.push({
                        file: corruption.file,
                        ...result,
                    });
                } catch (error) {
                    results.push({
                        file: corruption.file,
                        success: false,
                        error: error.message,
                    });
                }
            }

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            log.info("[RECOVERY] Batch recovery completed", {
                total: results.length,
                successful,
                failed,
            });

            return {
                success: failed === 0,
                results,
                summary: {
                    total: results.length,
                    successful,
                    failed,
                },
            };
        } catch (error) {
            log.error("[RECOVERY] Batch recovery failed", { error: error.message });
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get recovery status
     */
    function getRecoveryStatus() {
        const scan = scanForCorruption();

        return {
            timestamp: new Date().toISOString(),
            systemHealth: scan.corrupted.length === 0 ? "healthy" : "at-risk",
            corruptedFiles: scan.corrupted.length,
            backupsAvailable: scan.backupsAvailable,
            details: {
                corrupted: scan.corrupted,
            },
        };
    }

    /**
     * Monitor for corruptions
     */
    function startMonitoring(interval = 3600000) { // Every hour
        log.info("[RECOVERY] Starting corruption monitoring", { interval });

        setInterval(async () => {
            try {
                const scan = scanForCorruption();
                if (scan.corrupted.length > 0) {
                    log.warn("[RECOVERY] Corrupted files detected during monitoring", {
                        count: scan.corrupted.length,
                        files: scan.corrupted.map(c => c.file),
                    });

                    // Auto-attempt recovery for new corruptions
                    await recoverCorruptedFiles();
                }
            } catch (error) {
                log.error("[RECOVERY] Monitoring check failed", { error: error.message });
            }
        }, interval);
    }

    return {
        validateJsonFile,
        detectCorruption,
        scanForCorruption,
        recoverJsonFile,
        recoverCorruptedFiles,
        getRecoveryStatus,
        startMonitoring,
        attemptJsonRepair,
    };
}

module.exports = { createJsonRecoveryService };
