const { Events } = require("discord.js");

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(client, oldState) {
    const musicService = client.container?.services?.musicService;
    if (!musicService?.handleVoiceStateUpdate) return;
    try {
      await musicService.handleVoiceStateUpdate(oldState);
    } catch (error) {
      client.container?.logger?.error("voice state update failed", {
        guildId: oldState?.guild?.id,
        channelId: oldState?.channelId,
        error: error.message,
      });
    }
  },
};
