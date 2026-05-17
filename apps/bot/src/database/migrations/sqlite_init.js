const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

function initializeSQLiteDatabase(paths, logger) {
    return new Promise((resolve, reject) => {
        const dbPath = paths.database || path.join(paths.storage.temp, 'database.db');

        // Ensure directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                logger.error('[DB] Failed to connect to SQLite:', err);
                reject(err);
                return;
            }

            logger.info('[DB] Connected to SQLite database');

            // Enable WAL mode for better concurrency
            db.run('PRAGMA journal_mode = WAL', (err) => {
                if (err) logger.warn('[DB] Failed to enable WAL mode:', err);
            });

            // Hardening / crash-safety pragmas
            // - synchronous: tradeoff durability vs speed; WAL + NORMAL sudah jauh lebih aman dari DELETE journal
            // - busy_timeout: reduce "database is locked" errors under concurrency
            db.run('PRAGMA synchronous = NORMAL', (err) => {
                if (err) logger.warn('[DB] Failed to set PRAGMA synchronous:', err);
            });
            db.run('PRAGMA busy_timeout = 5000', (err) => {
                if (err) logger.warn('[DB] Failed to set PRAGMA busy_timeout:', err);
            });
            db.run('PRAGMA temp_store = MEMORY', (err) => {
                if (err) logger.warn('[DB] Failed to set PRAGMA temp_store:', err);
            });

            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) logger.warn('[DB] Failed to enable foreign keys:', err);
            });

            // Create tables with proper indexing
            createTables(db, logger)
                .then(() => {
                    // Best-effort integrity check (doesn't block init)
                    db.get('PRAGMA integrity_check', (integrityErr, row) => {
                        if (integrityErr) {
                            logger.warn('[DB] integrity_check failed (best-effort):', integrityErr);
                            resolve(db);
                            return;
                        }
                        const result = row?.integrity_check;
                        if (result && result !== 'ok') {
                            logger.error('[DB] integrity_check not ok:', result);
                        } else {
                            logger.info('[DB] integrity_check ok');
                        }
                        resolve(db);
                    });
                })
                .catch(reject);
        });

        // Handle connection errors
        db.on('error', (err) => {
            logger.error('[DB] SQLite error:', err);
        });
    });
}

async function createTables(db, logger) {
    const tables = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT,
      discriminator TEXT,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

        // Guilds table
        `CREATE TABLE IF NOT EXISTS guilds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      name TEXT,
      owner_id TEXT,
      config TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

        // Tickets table
        `CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT,
      status TEXT DEFAULT 'open',
      category TEXT,
      title TEXT,
      description TEXT,
      priority TEXT DEFAULT 'normal',
      assigned_to TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY (guild_id) REFERENCES guilds(discord_id)
    )`,

        // Orders table
        `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      ticket_id TEXT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      service_type TEXT,
      service_details TEXT, -- JSON string
      status TEXT DEFAULT 'pending',
      total_amount DECIMAL(10,2),
      currency TEXT DEFAULT 'IDR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(discord_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(discord_id)
    )`,

        // Payments table
        `CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount DECIMAL(10,2),
      currency TEXT DEFAULT 'IDR',
      method TEXT,
      status TEXT DEFAULT 'pending',
      transaction_id TEXT,
      proof_url TEXT,
      verified_by TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(discord_id)
    )`,

        // Cache table for persistent caching
        `CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

        // Audit logs table
        `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      guild_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT, -- JSON string
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    ];

    const indexes = [
        // Users indexes
        'CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id)',
        'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)',

        // Guilds indexes
        'CREATE INDEX IF NOT EXISTS idx_guilds_discord_id ON guilds(discord_id)',
        'CREATE INDEX IF NOT EXISTS idx_guilds_owner_id ON guilds(owner_id)',

        // Tickets indexes
        'CREATE INDEX IF NOT EXISTS idx_tickets_discord_id ON tickets(discord_id)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to)',

        // Orders indexes
        'CREATE INDEX IF NOT EXISTS idx_orders_discord_id ON orders(discord_id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_ticket_id ON orders(ticket_id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_guild_id ON orders(guild_id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
        'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',

        // Payments indexes
        'CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)',
        'CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
        'CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at)',

        // Cache indexes
        'CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)',

        // Audit logs indexes
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_guild_id ON audit_logs(guild_id)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
    ];

    // Execute table creation
    for (const sql of tables) {
        await runQuery(db, sql);
    }

    logger.info('[DB] Tables created');

    // Execute index creation
    for (const sql of indexes) {
        await runQuery(db, sql);
    }

    logger.info('[DB] Indexes created');
}

function runQuery(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

module.exports = { initializeSQLiteDatabase };
