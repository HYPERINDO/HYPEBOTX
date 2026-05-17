const { Events } = require("discord.js");

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(client, member) {
    const isRaid = await client.container.services.moderationService?.handleAntiRaid(member);
    if (isRaid) return; // Stop if it's a raid

    await client.container.services.verifyService.handleGuildMemberAdd(member);
  },
};
