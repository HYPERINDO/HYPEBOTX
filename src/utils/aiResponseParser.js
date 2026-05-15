function extractJsonObject(text) {
    if (!text || typeof text !== "string") return null;
    const trimmed = text.trim();
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;
    const candidate = trimmed.slice(first, last + 1);
    try {
        return JSON.parse(candidate);
    } catch {
        // fallback: try to remove trailing commas and comments
        const cleaned = candidate
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]")
            .replace(/\/\*.*?\*\//gs, "")
            .replace(/\/\/.*$/gm, "");
        try {
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }
}

function parseAIResponse(response) {
    if (!response) return null;
    if (typeof response !== "string") return response;
    const parsed = extractJsonObject(response);
    if (parsed && typeof parsed === "object") return parsed;

    // If not JSON, attempt value extraction from a valid-looking JSON string in the response.
    const jsonLike = response.match(/\{(?:[^{}]|\{[^{}]*\})*\}/s);
    if (jsonLike) {
        try {
            return JSON.parse(jsonLike[0]);
        } catch {
            return null;
        }
    }

    return null;
}

module.exports = {
    parseAIResponse,
};
