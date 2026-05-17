function createBackupRepository(database) {
  return {
    async getAll() {
      return database.read("backups", []);
    },
    async create(backup) {
      const rows = await database.read("backups", []);
      rows.push(backup);
      await database.write("backups", rows);
      return backup;
    },
  };
}

module.exports = {
  createBackupRepository,
};
