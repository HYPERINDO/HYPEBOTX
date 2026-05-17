const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const { componentIds, ticketTypes } = require("../../utils/constants");

function createTicketTypeSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(componentIds.ticketTypeSelect)
    .setPlaceholder("Pilih jenis ticket")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      ticketTypes.map((type) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(type.charAt(0).toUpperCase() + type.slice(1))
          .setValue(type)
          .setDescription(`Buka ticket ${type}`),
      ),
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  createTicketTypeSelectRow,
};
