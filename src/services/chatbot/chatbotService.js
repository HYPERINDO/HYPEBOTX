const fs = require("fs");
const path = require("path");

const { createRuleBasedProvider } = require("./providers/ruleBasedProvider");
const { createChatbotGuard } = require("./chatbotGuard");

function resolveKnowledgeBasePath() {
    const candidates = [
        process.env.PANDUAN_FILE_PATH,
        path.join(process.cwd(), "docs", "PANDUAN_FINAL_HYPEBOTX.md"),
        path.join(process.cwd(), "PANDUAN_FINAL_HYPEBOTX.md"),
        path.join(__dirname, "..", "..", "..", "docs", "PANDUAN_FINAL_HYPEBOTX.md"),
    ].filter((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function safeExtractPanduanSnippets(text) {
    if (!text || typeof text !== "string") return [];
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const snippets = [];
    // naive index: grab lines that look like headings or command mentions
    for (const line of lines) {
        if (!line) continue;
        if (/^#{1,6}\s+/.test(line)) {
            snippets.push(line.replace(/^#{1,6}\s+/, "").trim());
        } else if (line.includes("`/price`") || line.includes("`/order`") || line.includes("`/status`") || line.includes("`/faq`") || line.includes("`/refund`") || line.includes("`/warranty`")) {
            snippets.push(line);
        }
        if (snippets.length >= 80) break;
    }
    return snippets;
}

function createChatbotService({ client, storeOpsService }) {
    const guard = createChatbotGuard({ client });

    const provider = createRuleBasedProvider({ client, guard, storeOpsService });

    let panduanCache = null;
    function getKnowledgeBaseSnippets() {
        if (panduanCache) return panduanCache;
        try {
            const kbPath = resolveKnowledgeBasePath();
            if (kbPath) {
                const raw = fs.readFileSync(kbPath, "utf8");
                panduanCache = safeExtractPanduanSnippets(raw);
            } else {
                panduanCache = [];
            }
        } catch {
            panduanCache = [];
        }
        return panduanCache;
    }

    async function answer({ interaction, question, mode }) {
        const qRaw = String(question || "");
        const q = qRaw.trim();

        // Hard guard: never answer sensitive/external/invented data.
        // Provider must still consult DB/service when needed.
        return provider.answer({
            interaction,
            questionRaw: qRaw,
            question: q,
            mode,
            panduanSnippets: getKnowledgeBaseSnippets(),
        });
    }

    return { answer };
}

module.exports = {
    createChatbotService,
};
