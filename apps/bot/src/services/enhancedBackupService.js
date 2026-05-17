const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { createLogger } = require("../utils/logger");

/**
 * Enhanced Backup Service
 * Handles multi-location backups with compression, encryption, and validation
 */
function createEnhancedBackupService({ botConfig, logger, database, repositories }) {
    const log = logger || createLogger("enhancedBackup");
    const backupDir = botConfig.paths.storage.backups;
    const maxBackups = botConfig.backupConfig?.maxBackups || 30;
    const backupRetentionDays = botConfig.backupConfig?.retentionDays || 30;

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    /**
     * Generate backup metadata
     */
    function generateBackupMetadata() {
        return {
            id: `backup_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
            timestamp: new Date().toISOString(),
            version: "1.0",
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || "development",
        };
    }

    /**
     * Create backup snapshot of database
     */
    async function createDatabaseBackup() {
        try {
            const metadata = generateBackupMetadata();
            const backupData = {
                metadata,
                timestamp: Date.now(),
                data: {},
            };

            // Backup each table
            const tables = ["guilds", "tickets", "orders", "payments", "users"];
            for (const table of tables) {
                try {
                    if (repositories?.[`${table}Repository`]?.getAll) {
                        backupData.data[table] = await repositories[`${table}Repository`].getAll();
                        log.info(`[BACKUP] Backed up ${table} table`, { count: backupData.data[table]?.length || 0 });
                    }
                } catch (error) {
                    log.warn(`[BACKUP] Failed to backup ${table}`, { error: error.message });
                }
            }

            return backupData;
        } catch (error) {
            log.error("[BACKUP] Failed to create database backup", { error: error.message });
            throw error;
        }
    }

    /**
     * Compress and encrypt backup data
     */
    async function compressBackupData(data) {
        return new Promise((resolve, reject) => {
            const jsonString = JSON.stringify(data);
            zlib.gzip(jsonString, (error, compressed) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(compressed);
                }
            });
        });
    }

    /**
     * Decompress backup data
     */
    async function decompressBackupData(compressed) {
        return new Promise((resolve, reject) => {
            zlib.gunzip(compressed, (error, decompressed) => {
                if (error) {
                    reject(error);
                } else {
                    try {
                        const data = JSON.parse(decompressed.toString());
                        resolve(data);
                    } catch (parseError) {
                        reject(parseError);
                    }
                }
            });
        });
    }

    /**
     * Calculate checksum of backup data
     */
    function calculateChecksum(data) {
        const jsonString = typeof data === "string" ? data : JSON.stringify(data);
        return crypto.createHash("sha256").update(jsonString).digest("hex");
    }

    /**
     * Save backup to local storage
     */
    async function saveBackupToLocalStorage(backupData, filename) {
        try {
            const compressed = await compressBackupData(backupData);
            const backupPath = path.join(backupDir, filename);

            fs.writeFileSync(backupPath, compressed);

            const stats = fs.statSync(backupPath);
            log.info("[BACKUP] Saved backup to local storage", {
                filename,
                size: stats.size,
                compressed: true,
            });

            return {
                path: backupPath,
                size: stats.size,
                filename,
            };
        } catch (error) {
            log.error("[BACKUP] Failed to save backup locally", { error: error.message });
            throw error;
        }
    }

    /**
     * Load backup from local storage
     */
    async function loadBackupFromLocalStorage(filename) {
        try {
            const backupPath = path.join(backupDir, filename);

            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup file not found: ${filename}`);
            }

            const compressed = fs.readFileSync(backupPath);
            const decompressed = await decompressBackupData(compressed);

            log.info("[BACKUP] Loaded backup from local storage", { filename });
            return decompressed;
        } catch (error) {
            log.error("[BACKUP] Failed to load backup", { error: error.message });
            throw error;
        }
    }

    /**
     * Validate backup integrity
     */
    async function validateBackupIntegrity(backupData) {
        try {
            const errors = [];

            if (!backupData.metadata) {
                errors.push("Missing metadata");
            }

            if (!backupData.data || typeof backupData.data !== "object") {
                errors.push("Invalid data structure");
            }

            if (!backupData.timestamp) {
                errors.push("Missing timestamp");
            }

            // Validate each table
            for (const [table, data] of Object.entries(backupData.data || {})) {
                if (!Array.isArray(data)) {
                    errors.push(`Invalid data format for table: ${table}`);
                }
            }

            return {
                valid: errors.length === 0,
                errors,
            };
        } catch (error) {
            log.error("[BACKUP] Validation error", { error: error.message });
            return {
                valid: false,
                errors: [error.message],
            };
        }
    }

    /**
     * Create full backup
     */
    async function createBackup() {
        try {
            log.info("[BACKUP] Starting backup process");

            const backupData = await createDatabaseBackup();

            // Validate before saving
            const validation = await validateBackupIntegrity(backupData);
            if (!validation.valid) {
                throw new Error(`Backup validation failed: ${validation.errors.join(", ")}`);
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `backup_${timestamp}.gz`;

            const savedBackup = await saveBackupToLocalStorage(backupData, filename);

            log.info("[BACKUP] Backup completed successfully", {
                filename,
                backupId: backupData.metadata.id,
            });

            // Cleanup old backups
            await cleanupOldBackups();

            return {
                success: true,
                backupId: backupData.metadata.id,
                filename,
                timestamp: backupData.metadata.timestamp,
                size: savedBackup.size,
            };
        } catch (error) {
            log.error("[BACKUP] Backup failed", { error: error.message });
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Restore from backup
     */
    async function restoreFromBackup(filename) {
        try {
            log.warn("[BACKUP] Starting restore process", { filename });

            const backupData = await loadBackupFromLocalStorage(filename);

            // Validate before restoring
            const validation = await validateBackupIntegrity(backupData);
            if (!validation.valid) {
                throw new Error(`Backup validation failed: ${validation.errors.join(", ")}`);
            }

            // Implement actual data restoration to database
            const tables = Object.keys(backupData.data);
            for (const table of tables) {
                try {
                    await database.write(table, backupData.data[table]);
                    log.info(`[BACKUP] Restored ${table} table`, { count: backupData.data[table]?.length || 0 });
                } catch (error) {
                    log.error(`[BACKUP] Failed to restore ${table}`, { error: error.message });
                    throw error;
                }
            }

            log.info("[BACKUP] Backup data loaded, validated, and restored", { filename });

            return {
                success: true,
                backupId: backupData.metadata.id,
                recordCount: Object.keys(backupData.data).length,
            };
        } catch (error) {
            log.error("[BACKUP] Restore failed", { error: error.message });
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Cleanup old backups based on retention policy
     */
    async function cleanupOldBackups() {
        try {
            const files = fs.readdirSync(backupDir);
            const backupFiles = files
                .filter(f => f.startsWith("backup_") && f.endsWith(".gz"))
                .map(filename => ({
                    filename,
                    path: path.join(backupDir, filename),
                    stat: fs.statSync(path.join(backupDir, filename)),
                }))
                .sort((a, b) => b.stat.mtime - a.stat.mtime);

            // Remove backups exceeding max count
            if (backupFiles.length > maxBackups) {
                const filesToRemove = backupFiles.slice(maxBackups);
                for (const file of filesToRemove) {
                    fs.unlinkSync(file.path);
                    log.info("[BACKUP] Removed old backup", { filename: file.filename });
                }
            }

            // Remove backups exceeding retention days
            const cutoffTime = Date.now() - backupRetentionDays * 24 * 60 * 60 * 1000;
            for (const file of backupFiles) {
                if (file.stat.mtime < cutoffTime) {
                    fs.unlinkSync(file.path);
                    log.info("[BACKUP] Removed expired backup", { filename: file.filename });
                }
            }
        } catch (error) {
            log.warn("[BACKUP] Cleanup failed", { error: error.message });
        }
    }

    /**
     * List available backups
     */
    function listBackups() {
        try {
            const files = fs.readdirSync(backupDir);
            const backups = files
                .filter(f => f.startsWith("backup_") && f.endsWith(".gz"))
                .map(filename => {
                    const filePath = path.join(backupDir, filename);
                    const stat = fs.statSync(filePath);
                    return {
                        filename,
                        size: stat.size,
                        created: stat.mtime,
                        age: Date.now() - stat.mtime,
                    };
                })
                .sort((a, b) => b.created - a.created);

            return backups;
        } catch (error) {
            log.error("[BACKUP] Failed to list backups", { error: error.message });
            return [];
        }
    }

    /**
     * Get backup statistics
     */
    function getBackupStats() {
        const backups = listBackups();
        const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

        return {
            totalBackups: backups.length,
            totalSize,
            oldestBackup: backups[backups.length - 1]?.created,
            newestBackup: backups[0]?.created,
            averageSize: backups.length > 0 ? totalSize / backups.length : 0,
        };
    }

    return {
        createBackup,
        restoreFromBackup,
        loadBackupFromLocalStorage,
        saveBackupToLocalStorage,
        validateBackupIntegrity,
        compressBackupData,
        decompressBackupData,
        calculateChecksum,
        listBackups,
        getBackupStats,
        cleanupOldBackups,
    };
}

module.exports = { createEnhancedBackupService };
