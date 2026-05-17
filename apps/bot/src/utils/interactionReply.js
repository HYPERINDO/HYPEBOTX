const { MessageFlags } = require("discord.js");

function logReplyError(interaction, action, error) {
  interaction?.client?.container?.logger?.warn?.(`${action} failed`, {
    interactionId: interaction?.id,
    guildId: interaction?.guildId,
    userId: interaction?.user?.id,
    message: error?.message || String(error),
  });
}

async function safeReply(interaction, contentOrPayload, options = {}) {
  // Accept either (interaction, payloadObject) or (interaction, contentString, options)
  const payload = (contentOrPayload && typeof contentOrPayload === 'object' && (contentOrPayload.content !== undefined || contentOrPayload.embeds !== undefined || contentOrPayload.flags !== undefined))
    ? { ...contentOrPayload }
    : { content: contentOrPayload, ...options };

  try {
    if (interaction.deferred || interaction.replied) {
      const res = await interaction.followUp(payload).catch((error) => {
        logReplyError(interaction, "safeReply followUp", error);
        return null;
      });
      return typeof payload.content === 'string' ? payload.content : res;
    }

    const res = await interaction.reply(payload).catch((error) => {
      logReplyError(interaction, "safeReply reply", error);
      return null;
    });
    return typeof payload.content === 'string' ? payload.content : res;
  } catch (error) {
    logReplyError(interaction, "safeReply final", error);
    return null;
  }
}

async function safeEphemeralReply(interaction, content, options = {}) {
  const payload = {
    content,
    flags: MessageFlags.Ephemeral,
    ...options,
  };

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload).catch((error) => {
      logReplyError(interaction, "safeEphemeralReply followUp", error);
      return null;
    });
  }

  return interaction.reply(payload).catch((error) => {
    logReplyError(interaction, "safeEphemeralReply reply", error);
    return null;
  });
}

async function safeEditReply(interaction, content, options = {}) {
  if (!interaction.deferred && !interaction.replied) {
    return interaction
      .reply({
        content,
        flags: MessageFlags.Ephemeral,
        ...options,
      })
      .catch((error) => {
        logReplyError(interaction, "safeEditReply initial reply", error);
        return null;
      });
  }

  return interaction.editReply({
    content,
    ...options,
  }).catch((error) => {
    logReplyError(interaction, "safeEditReply editReply", error);
    return null;
  });
}

module.exports = {
  safeReply,
  safeEphemeralReply,
  safeEditReply,
};
