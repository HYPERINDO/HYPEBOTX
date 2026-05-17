const { normalizeTextChannelName } = require("./normalizeName");

function normalizeCategoryName(name) {
  return normalizeTextChannelName(String(name || "").replace(/[^a-zA-Z0-9\s-]/g, " "));
}

async function ensureCategory(guild, name) {
  const normalizedName = normalizeCategoryName(name);
  let category = guild.channels.cache.find(
    (channel) =>
      channel.type === 4 &&
      normalizeCategoryName(channel.name) === normalizedName,
  );

  if (!category) {
    category = await guild.channels.create({
      name,
      type: 4,
      reason: "Setup kategori GameStore",
    });
  }

  return category;
}

module.exports = {
  ensureCategory,
};
