const interactionCreateEvent = require("../../src/events/interaction/interactionCreate");

async function dispatchInteraction(client, interaction) {
    return interactionCreateEvent.execute(client, interaction);
}

module.exports = { dispatchInteraction };
