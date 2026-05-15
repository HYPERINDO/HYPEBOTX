const DISCORD_CONTENT_LIMIT = 2000;

function clampContent(content, limit = DISCORD_CONTENT_LIMIT) {
  const text = String(content ?? "");
  if (text.length <= limit) return text;

  const marker = "\n\n[Dipotong karena melebihi limit Discord]";
  return `${text.slice(0, Math.max(0, limit - marker.length))}${marker}`;
}

function chunkLines(lines, limit = DISCORD_CONTENT_LIMIT) {
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : String(line);
    if (next.length > limit) {
      if (current) chunks.push(current);
      current = String(line).slice(0, limit);
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitDiscordMessage(text, maxLength = 1900) {
  const chunks = [];
  let content = String(text || "");

  while (content.length > maxLength) {
    let splitAt = content.lastIndexOf("\n", maxLength);

    if (splitAt < 1000) {
      splitAt = maxLength;
    }

    chunks.push(content.slice(0, splitAt));
    content = content.slice(splitAt).trimStart();
  }

  if (content.length > 0) {
    chunks.push(content);
  }

  return chunks;
}

async function sendLongReply(interaction, text) {
  const chunks = splitDiscordMessage(text);

  if (chunks.length === 0) {
    return interaction.editReply({
      content: "Tidak ada hasil."
    });
  }

  await interaction.editReply({
    content: chunks[0]
  });


  const { MessageFlags } = require("discord.js");

  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({
      content: chunk,
      flags: MessageFlags.Ephemeral
    });
  }
}

async function sendAuditAsFile(interaction, auditText, filename = "audit-report.txt") {
  const { AttachmentBuilder } = require("discord.js");
  const buffer = Buffer.from(auditText, "utf-8");
  const file = new AttachmentBuilder(buffer, { name: filename });

  // Kirim hanya attachment agar tidak ada risiko "content terlalu panjang"
  await interaction.editReply({
    content: "",
    files: [file],
  });
}

async function safeReply(interaction, payload) {
  // Delegate to the centralized safeReply implementation
  const { safeReply: _safeReply } = require("./interactionReply");
  return _safeReply(interaction, payload);
}

module.exports = {
  DISCORD_CONTENT_LIMIT,
  clampContent,
  chunkLines,
  splitDiscordMessage,
  sendLongReply,
  sendAuditAsFile,
  safeReply,
};
