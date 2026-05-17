const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const { componentIds, orderStatuses } = require("../../utils/constants");

function createOrderStatusSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(componentIds.orderStatusSelect)
    .setPlaceholder("Pilih status order")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      orderStatuses.map((status) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(status)
          .setValue(status)
          .setDescription(`Set status ke ${status}`),
      ),
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  createOrderStatusSelectRow,
};
