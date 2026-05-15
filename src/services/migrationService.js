const { createLogger } = require("../utils/logger");
const fs = require("fs");
const path = require("path");

/**
 * Database Migration Service
 * Handles zero-downtime database migrations with rollback capabilities
 */
function createMigrationService({ botConfig, logger, database }) {
    const log = logger || createLogger("migration");
    const migrationsDir = path.join(botConfig.paths.storage.root, "migrations");
    const migrationServiceEnabled = true;

    // Ensure migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
    }

    /**
     * Create a new migration
     */
    async function createMigration(name) {
        const timestamp = Date.now();
        const migrationName = `${timestamp}_${name}.js`;
        const migrationPath = path.join(migrationsDir, migrationName);

        const template = `
/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  // Migration name
  name: '${name}',
  
  // Run this migration
  async up(database) {
    log.info(\`Migrating up: ${name}\`);
    // TODO: Implement your migration logic here
    // Example: await database.query('ALTER TABLE users ADD COLUMN new_column VARCHAR(255)');
  },

  // Rollback this migration
  async down(database) {
    log.info(\`Migrating down: ${name}\`);
    // TODO: Implement your rollback logic here
    // Example: await database.query('ALTER TABLE users DROP COLUMN new_column');
  },

  // Check if migration can be run
  async canRun(database) {
    // TODO: Add pre-flight checks
    return true;
  },

  // Validate migration success
  async validate(database) {
    // TODO: Add validation logic
    return true;
  },
};
`;

        fs.writeFileSync(migrationPath, template);
        log.info("[MIGRATION] Created new migration", { name, path: migrationPath });

        return {
            created: true,
            path: migrationPath,
            name: migrationName,
        };
    }

    /**
     * Get all migrations
     */
    async function getMigrations() {
        try {
            const files = fs.readdirSync(migrationsDir);
            const migrations = [];

            for (const file of files) {
                if (file.endsWith(".js")) {
                    const migrationPath = path.join(migrationsDir, file);
                    const migration = require(migrationPath);
                    migrations.push({
                        file,
                        name: migration.name,
                        path: migrationPath,
                    });
                }
            }

            return migrations.sort((a, b) => {
                const timestampA = parseInt(a.file.split("_")[0]);
                const timestampB = parseInt(b.file.split("_")[0]);
                return timestampA - timestampB;
            });
        } catch (error) {
            log.error("[MIGRATION] Failed to get migrations", { error: error.message });
            return [];
        }
    }

    /**
     * Get migration history
     */
    async function getMigrationHistory() {
        try {
            const historyPath = path.join(migrationsDir, ".history.json");
            if (fs.existsSync(historyPath)) {
                const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
                return history;
            }
            return [];
        } catch (error) {
            log.warn("[MIGRATION] Failed to get history", { error: error.message });
            return [];
        }
    }

    /**
     * Record migration in history
     */
    async function recordMigration(migrationName, direction) {
        try {
            const historyPath = path.join(migrationsDir, ".history.json");
            const history = await getMigrationHistory();

            history.push({
                migration: migrationName,
                direction, // "up" or "down"
                timestamp: new Date().toISOString(),
                status: "pending",
            });

            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        } catch (error) {
            log.error("[MIGRATION] Failed to record migration", { error: error.message });
        }
    }

    /**
     * Run pending migrations
     */
    async function runMigrations() {
        if (!migrationServiceEnabled) {
            log.warn("[MIGRATION] Service disabled, skipping runMigrations");
            return {
                success: true,
                message: "Migration service disabled",
                migrations: [],
            };
        }

        try {
            log.info("[MIGRATION] Starting migration process");
            const migrations = await getMigrations();
            const history = await getMigrationHistory();
            const ranMigrations = new Set(
                history.filter(h => h.direction === "up").map(h => h.migration)
            );

            const pending = migrations.filter(m => !ranMigrations.has(m.name));

            if (pending.length === 0) {
                log.info("[MIGRATION] No pending migrations");
                return {
                    success: true,
                    message: "No pending migrations",
                    migrations: [],
                };
            }

            const results = [];

            for (const migration of pending) {
                try {
                    const mod = require(migration.path);

                    // Check if can run
                    if (mod.canRun && !(await mod.canRun(database))) {
                        log.warn("[MIGRATION] Migration cannot run", { name: migration.name });
                        results.push({
                            name: migration.name,
                            status: "skipped",
                            reason: "Pre-flight checks failed",
                        });
                        continue;
                    }

                    log.info("[MIGRATION] Running migration", { name: migration.name });
                    await mod.up(database);

                    // Validate
                    if (mod.validate && !(await mod.validate(database))) {
                        throw new Error("Migration validation failed");
                    }

                    await recordMigration(migration.name, "up");

                    results.push({
                        name: migration.name,
                        status: "success",
                    });

                    log.info("[MIGRATION] Migration completed", { name: migration.name });
                } catch (error) {
                    log.error("[MIGRATION] Migration failed", { name: migration.name, error: error.message });
                    results.push({
                        name: migration.name,
                        status: "failed",
                        error: error.message,
                    });
                }
            }

            return {
                success: results.every(r => r.status !== "failed"),
                migrations: results,
            };
        } catch (error) {
            log.error("[MIGRATION] Migration process failed", { error: error.message });
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Rollback last migration
     */
    async function rollbackMigration(steps = 1) {
        if (!migrationServiceEnabled) {
            log.warn("[MIGRATION] Service disabled, skipping rollbackMigration", { steps });
            return {
                success: true,
                message: "Migration service disabled",
                migrations: [],
            };
        }

        try {
            log.warn("[MIGRATION] Starting rollback", { steps });

            const history = await getMigrationHistory();
            const executed = history.filter(h => h.direction === "up").slice(-steps);

            if (executed.length === 0) {
                log.info("[MIGRATION] No migrations to rollback");
                return {
                    success: true,
                    message: "No migrations to rollback",
                };
            }

            const results = [];

            for (const record of executed.reverse()) {
                try {
                    const migrations = await getMigrations();
                    const migration = migrations.find(m => m.name === record.migration);

                    if (!migration) {
                        log.error("[MIGRATION] Migration not found for rollback", { name: record.migration });
                        results.push({
                            name: record.migration,
                            status: "failed",
                            reason: "Migration file not found",
                        });
                        continue;
                    }

                    const mod = require(migration.path);

                    log.info("[MIGRATION] Rolling back migration", { name: migration.name });
                    await mod.down(database);

                    await recordMigration(migration.name, "down");

                    results.push({
                        name: migration.name,
                        status: "success",
                    });

                    log.info("[MIGRATION] Rollback completed", { name: migration.name });
                } catch (error) {
                    log.error("[MIGRATION] Rollback failed", { error: error.message });
                    results.push({
                        name: record.migration,
                        status: "failed",
                        error: error.message,
                    });
                }
            }

            return {
                success: results.every(r => r.status !== "failed"),
                migrations: results,
            };
        } catch (error) {
            log.error("[MIGRATION] Rollback process failed", { error: error.message });
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get migration status
     */
    async function getStatus() {
        if (!migrationServiceEnabled) {
            return {
                enabled: false,
                totalMigrations: 0,
                executedMigrations: 0,
                pendingMigrations: 0,
                migrations: [],
                lastRun: null,
                message: "Migration service disabled",
            };
        }

        const migrations = await getMigrations();
        const history = await getMigrationHistory();
        const executed = new Set(history.filter(h => h.direction === "up").map(h => h.migration));

        return {
            enabled: migrationServiceEnabled,
            totalMigrations: migrations.length,
            executedMigrations: executed.size,
            pendingMigrations: migrations.length - executed.size,
            migrations: migrations.map(m => ({
                name: m.name,
                executed: executed.has(m.name),
            })),
            lastRun: history[history.length - 1]?.timestamp || null,
        };
    }

    return {
        createMigration,
        getMigrations,
        getMigrationHistory,
        runMigrations,
        rollbackMigration,
        getStatus,
    };
}

module.exports = { createMigrationService };
