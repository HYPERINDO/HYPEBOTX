const { Events } = require("discord.js");

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(client, member) {
    await client.container.services.verifyService.handleGuildMemberRemove(member);
  },
};
