function createGuildConfig(guildId, templateKey = "gamestore") {
  return {
    guildId,
    templateKey,
    setupCompleted: false,
    channels: {},
    roles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  createGuildConfig,
};
