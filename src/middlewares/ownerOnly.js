const roleNames = require("../config/roles");

function ownerOnly(interaction) {
  const member = interaction.member;
  return (
    interaction.guild &&
    (interaction.guild.ownerId === interaction.user.id ||
      member.roles.cache.some((role) => role.name === roleNames.owner))
  );
}

module.exports = {
  ownerOnly,
};
