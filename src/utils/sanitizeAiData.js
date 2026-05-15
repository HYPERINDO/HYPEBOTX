function sanitizeAiData(input) {
    const raw = typeof input === "string" ? input : JSON.stringify(input, null, 2);

    const sanitized = raw
        .replace(/DISCORD_TOKEN\s*=\s*[^\n\r]+/gi, "DISCORD_TOKEN=[REDACTED]")
        .replace(/OPENAI_API_KEY\s*=\s*[^\n\r]+/gi, "OPENAI_API_KEY=[REDACTED]")
        .replace(/CLIENT_SECRET\s*=\s*[^\n\r]+/gi, "CLIENT_SECRET=[REDACTED]")
        .replace(/WEBHOOK_URL\s*=\s*[^\n\r]+/gi, "WEBHOOK_URL=[REDACTED]")
        .replace(/(password|pass|pw)["']?\s*[:=]\s*["'][^"']+["']/gi, '$1:"[REDACTED]"')
        .replace(/(token|api[_-]?key|secret|authorization)["']?\s*[:=]\s*["'][^"']+["']/gi, '$1:"[REDACTED]"')
        .replace(/\b(?:password|pass|pw)\b\s*[:=]?\s*\S+/gi, "[REDACTED]")
        .replace(/\b(?:token|api[_-]?key|authorization|session|cookie)\b\s*[:=]?\s*\S+/gi, "[REDACTED]")
        .replace(/raw payment proof/gi, "[REDACTED]");

    try {
        return JSON.parse(sanitized);
    } catch {
        return sanitized;
    }
}

module.exports = {
    sanitizeAiData,
};
