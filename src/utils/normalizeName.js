function normalizeTextChannelName(name) {
  return String(name || "")
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "-")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeVoiceChannelName(name) {
  return String(name || "")
    .normalize("NFKD")
    .trim()
    .replace(/[^a-zA-Z0-9\s-]+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

module.exports = {
  normalizeTextChannelName,
  normalizeVoiceChannelName,
};
