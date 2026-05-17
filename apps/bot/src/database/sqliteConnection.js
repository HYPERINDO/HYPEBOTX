const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { initializeSQLiteDatabase } = require('./migrations/sqlite_init');

class SQLiteDatabase {
    constructor(paths, logger) {
        this.paths = paths;
        this.logger = logger;
        this.db = null;
        this.dbPath = paths.database || path.join(paths.storage.temp, 'database.db');
    }

    async init() {
        try {
            this.db = await initializeSQLiteDatabase(this.paths, this.logger);
            this.logger.info('[DB] SQLite database initialized successfully');
        } catch (error) {
            this.logger.error('[DB] SQLite database initialization failed:', error);
            throw error;
        }
    }

    // Generic query method
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    this.logger.error('[DB] Query error:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Get single record
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    this.logger.error('[DB] Get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Insert method (atomic write)
    async insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;

        let result;

        try {
            await new Promise((resolve, reject) => {
                this.db.run('BEGIN IMMEDIATE', (err) => (err ? reject(err) : resolve()));
            });

            result = await new Promise((resolve, reject) => {
                this.db.run(sql, values, function (err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID, changes: this.changes });
                });
            });

            await new Promise((resolve, reject) => {
                this.db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
            });

            return result;
        } catch (error) {
            try {
                await new Promise((resolve) => {
                    this.db.run('ROLLBACK', () => resolve());
                });
            } catch {
                // ignore
            }
            this.logger.error('[DB] Insert error:', error);
            throw error;
        }
    }

    // Update method (atomic write)
    async update(table, data, where) {
        const setKeys = Object.keys(data);
        const setValues = Object.values(data);
        const whereKeys = Object.keys(where);
        const whereValues = Object.values(where);

        const setClause = setKeys.map((key) => `${key} = ?`).join(', ');
        const whereClause = whereKeys.map((key) => `${key} = ?`).join(' AND ');

        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        const params = [...setValues, ...whereValues];

        let changesResult = 0;

        try {
            await new Promise((resolve, reject) => {
                this.db.run('BEGIN IMMEDIATE', (err) => (err ? reject(err) : resolve()));
            });

            changesResult = await new Promise((resolve, reject) => {
                this.db.run(sql, params, function (err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                });
            });

            await new Promise((resolve, reject) => {
                this.db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
            });

            return { changes: changesResult };
        } catch (error) {
            try {
                await new Promise((resolve) => {
                    this.db.run('ROLLBACK', () => resolve());
                });
            } catch {
                // ignore
            }
            this.logger.error('[DB] Update error:', error);
            throw error;
        }
    }

    // Delete method (atomic write)
    async delete(table, where) {
        const whereKeys = Object.keys(where);
        const whereValues = Object.values(where);
        const whereClause = whereKeys.map((key) => `${key} = ?`).join(' AND ');

        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;

        let changesResult = 0;

        try {
            await new Promise((resolve, reject) => {
                this.db.run('BEGIN IMMEDIATE', (err) => (err ? reject(err) : resolve()));
            });

            changesResult = await new Promise((resolve, reject) => {
                this.db.run(sql, whereValues, function (err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                });
            });

            await new Promise((resolve, reject) => {
                this.db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
            });

            return { changes: changesResult };
        } catch (error) {
            try {
                await new Promise((resolve) => {
                    this.db.run('ROLLBACK', () => resolve());
                });
            } catch {
                // ignore
            }
            this.logger.error('[DB] Delete error:', error);
            throw error;
        }
    }

    // Find single record by conditions
    async findOne(table, where) {
        const whereKeys = Object.keys(where);
        const whereValues = Object.values(where);
        const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');

        const sql = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`;

        return new Promise((resolve, reject) => {
            this.db.get(sql, whereValues, (err, row) => {
                if (err) {
                    this.logger.error('[DB] FindOne error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Find multiple records with optional conditions
    async find(table, where = {}, options = {}) {
        let sql = `SELECT * FROM ${table}`;
        const params = [];

        if (Object.keys(where).length > 0) {
            const whereKeys = Object.keys(where);
            const whereValues = Object.values(where);
            const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');
            sql += ` WHERE ${whereClause}`;
            params.push(...whereValues);
        }

        if (options.orderBy) {
            sql += ` ORDER BY ${options.orderBy}`;
        }

        if (options.limit) {
            sql += ` LIMIT ?`;
            params.push(options.limit);
        }

        if (options.offset) {
            sql += ` OFFSET ?`;
            params.push(options.offset);
        }

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    this.logger.error('[DB] Find error:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Count records
    async count(table, where = {}) {
        let sql = `SELECT COUNT(*) as count FROM ${table}`;
        const params = [];

        if (Object.keys(where).length > 0) {
            const whereKeys = Object.keys(where);
            const whereValues = Object.values(where);
            const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');
            sql += ` WHERE ${whereClause}`;
            params.push(...whereValues);
        }

        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    this.logger.error('[DB] Count error:', err);
                    reject(err);
                } else {
                    resolve(row.count || 0);
                }
            });
        });
    }

    // Transaction support
    async transaction(callback) {
        return new Promise((resolve, reject) => {
            this.db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    this.logger.error('[DB] Transaction begin error:', err);
                    reject(err);
                    return;
                }

                const commit = () => {
                    return new Promise((resolve, reject) => {
                        this.db.run('COMMIT', (err) => {
                            if (err) {
                                this.logger.error('[DB] Transaction commit error:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                };

                const rollback = () => {
                    return new Promise((resolve) => {
                        this.db.run('ROLLBACK', (err) => {
                            if (err) {
                                this.logger.error('[DB] Transaction rollback error:', err);
                            }
                            resolve();
                        });
                    });
                };

                callback({ commit, rollback })
                    .then(resolve)
                    .catch(async (error) => {
                        await rollback();
                        reject(error);
                    });
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        this.logger.error('[DB] Close error:', err);
                    } else {
                        this.logger.info('[DB] Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }
}

function createSQLiteDatabase(paths, logger) {
    return new SQLiteDatabase(paths, logger);
}

module.exports = { createSQLiteDatabase };
