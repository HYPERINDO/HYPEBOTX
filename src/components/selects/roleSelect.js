const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const roles = require("../../config/roles");
const { componentIds } = require("../../utils/constants");

function createRoleSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(componentIds.roleSelect)
    .setPlaceholder("Pilih LEGACY / ENHANCED")
    .setMinValues(0)
    .setMaxValues(roles.selfRoles.length)
    .addOptions(
      roles.selfRoles.map((roleName) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(roleName)
          .setValue(roleName)
          .setDescription(`Ambil atau lepas role ${roleName}`),
      ),
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  createRoleSelectRow,
};
