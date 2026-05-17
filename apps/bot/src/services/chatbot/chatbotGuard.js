const { MessageFlags } = require("discord.js");
const { safeReply } = require("../../utils/discordResponse.js");

function containsSensitiveTokenPatterns(text) {
  const t = String(text || "");
  // password-like
  if (/(password|pass|pw)\s*[:=]\s*\S+/i.test(t)) return true;
  // discord token patterns (best-effort)
  if (/\b[\w-]{24}\.[\w-]{6}\.[\w-]{27}\b/.test(t)) return true;
  // email
  if (/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(t)) return true;
  // generic API key patterns
  if (/(api[_-]?key|token)\s*[:=]\s*\S+/i.test(t)) return true;
  return false;
}

function createChatbotGuard({ client }) {
  async function enforceFallback(interaction, reason = "not_found") {
    return safeReply(interaction, {
      content: reason === "not_found"
        ? "Datanya belum ketemu kak, aku arahkan ke admin ya."
        : "Ini perlu dicek admin ya kak.",
      flags: MessageFlags.Ephemeral,
    });
  }

  function isLikelyAskingForSensitiveData(text) {
    const t = String(text || "");
    if (containsSensitiveTokenPatterns(t)) return true;
    return /(password|pass|pw|login|credential|credit card|ccv|cvv|token|api[_-]?key|license|lisensi|email)/i.test(t);
  }

  function isAskingForBusinessData(text) {
    const t = String(text || "").toLowerCase();
    const keys = [
      "harga", "price", "stock", "order", "status order", "payment", "invoice", "coupon", "refund",
      "warranty", "dispute", "joki", "komisi", "mutasi",
    ];
    return keys.some((k) => t.includes(k));
  }

  function isLikelyGeneralQuestion(text) {
    return !isAskingForBusinessData(text);
  }

  return {
    enforceFallback,
    isLikelyAskingForSensitiveData,
    isAskingForBusinessData,
    isLikelyGeneralQuestion,
  };
}

module.exports = {
  createChatbotGuard,
};
