const { SlashCommandBuilder } = require("discord.js");
const { staffCommand } = require("../../config/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("claim-ticket")
    .setDescription("Claim ticket saat ini.")
    .setDefaultMemberPermissions(staffCommand),
  async execute(interaction, client) {
    await client.container.services.ticketService.claimTicket(interaction);
  },
};
