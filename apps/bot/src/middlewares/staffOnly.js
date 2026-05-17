const roleNames = require("../config/roles");

function staffOnly(interaction) {
  const member = interaction.member;
  return member.roles.cache.some((role) => [roleNames.owner, roleNames.staff].includes(role.name));
}

module.exports = {
  staffOnly,
};
