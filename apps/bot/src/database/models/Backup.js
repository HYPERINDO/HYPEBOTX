function createBackup(payload) {
  return {
    id: payload.id,
    guildId: payload.guildId,
    fileName: payload.fileName,
    createdAt: payload.createdAt || new Date().toISOString(),
    meta: payload.meta || {},
  };
}

module.exports = {
  createBackup,
};
