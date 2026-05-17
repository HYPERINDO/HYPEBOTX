const { normalizeTextChannelName } = require("./normalizeName");

async function ensureChannel(guild, category, template, permissionOverwrites) {
  // Double-check category capacity before proceeding
  const channelsInCategory = guild.channels.cache.filter(ch => ch.parentId === category.id).size;
  if (channelsInCategory >= 50) {
    throw new Error(`Kategori ${category.name} sudah penuh (50 channel). Tidak dapat membuat channel ${template.name}.`);
  }

  const normalizedTemplateName = normalizeTextChannelName(template.name);
  let channel = guild.channels.cache.find(
    (entry) =>
      entry.parentId === category.id &&
      entry.type === template.type &&
      normalizeTextChannelName(entry.name) === normalizedTemplateName,
  );

  const payload = {
    parent: category.id,
    type: template.type,
    permissionOverwrites,
    reason: "Sinkron struktur GameStore",
  };

  if (typeof template.topic === "string" && template.type !== 2) {
    payload.topic = template.topic;
  }

  if (!channel) {
    channel = await guild.channels.create({
      name: template.name,
      ...payload,
    });
  } else {
    await channel.edit({
      ...payload,
      name: template.name,
    });
  }

  return channel;
}

module.exports = {
  ensureChannel,
};
