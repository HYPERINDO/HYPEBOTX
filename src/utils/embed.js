const { EmbedBuilder } = require("discord.js");

function toDisplayText(value, fallback = "-") {
  if (value === undefined || value === null) return fallback;

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || fallback;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "object") {
    if (typeof value.text === "string" && value.text.trim()) {
      return value.text.trim();
    }

    try {
      const json = JSON.stringify(value);
      if (json && json !== "{}" && json !== "[]") {
        return json;
      }
    } catch {
      // ignore JSON conversion issues
    }
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function safeText(value, fallback = "-") {
  const text = toDisplayText(value, fallback);
  if (!text) return fallback;

  return text.length > 4096 ? `${text.slice(0, 4093)}...` : text;
}

function safeTitle(value, fallback = "HYPEBOTX") {
  const text = toDisplayText(value, fallback);
  if (!text) return fallback;

  return text.length > 256 ? `${text.slice(0, 253)}...` : text;
}

function safeFieldText(value, fallback = "-", limit = 1024) {
  const text = toDisplayText(value, fallback);
  if (!text) return fallback;
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 3))}...` : text;
}

/**
 * Backward compatible:
 * - createEmbed({ title, description, color, fields, footer })
 * - createEmbed(title, description, color)
 */
function createEmbed(arg1, arg2, arg3) {
  let params;

  if (typeof arg1 === "object" && arg1 !== null) {
    params = arg1;
  } else {
    params = { title: arg1, description: arg2, color: arg3 };
  }

  const {
    title,
    description,
    color = 0x2b2d31,
    fields = [],
    footer,
  } = params;

  const embed = new EmbedBuilder().setColor(color);

  // Always provide safe strings to discord.js builders
  const safeT = safeTitle(title, "");
  if (safeT) embed.setTitle(safeT);

  const safeD = safeText(description, "-");
  try {
    embed.setDescription(safeD);
  } catch {
    // Absolute fallback for validator edge cases
    embed.setDescription("-");
  }

  if (Array.isArray(fields) && fields.length) {
    const safeFields = fields
      .map((field) => ({
        name: safeFieldText(field?.name, "-", 256),
        value: safeFieldText(field?.value, "-", 1024),
        inline: Boolean(field?.inline),
      }))
      .slice(0, 25);

    try {
      embed.addFields(safeFields);
    } catch {
      // Best effort: keep embed valid even if field payload has edge cases.
    }
  }

  if (footer) {
    if (typeof footer === "object" && footer !== null) {
      const footerText = safeFieldText(footer.text, "-", 2048);
      const footerIcon = typeof footer.iconURL === "string" ? footer.iconURL : undefined;
      embed.setFooter(footerIcon ? { text: footerText, iconURL: footerIcon } : { text: footerText });
    } else {
      embed.setFooter({ text: safeFieldText(footer, "-", 2048) });
    }
  }

  embed.setTimestamp(new Date());
  return embed;
}

module.exports = {
  createEmbed,
  safeText,
  safeTitle,
  safeFieldText,
};
