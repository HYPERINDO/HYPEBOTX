function createRoleConfig(guildId, roles = {}) {
  return {
    guildId,
    roles,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  createRoleConfig,
};
