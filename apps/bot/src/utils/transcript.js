async function buildTranscript(channel) {
  let before;
  const messages = [];

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) {
      break;
    }

    messages.push(...batch.values());
    before = batch.last().id;

    if (batch.size < 100) {
      break;
    }
  }

  return messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((message) => {
      const attachmentList = [...message.attachments.values()].map((file) => file.url).join(", ");
      return [
        `[${message.createdAt.toISOString()}]`,
        message.author.tag,
        message.content || "(tanpa teks)",
        attachmentList ? ` | attachments: ${attachmentList}` : "",
      ].join(" ");
    })
    .join("\n");
}

module.exports = {
  buildTranscript,
};
