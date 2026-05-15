const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { sanitizeText } = require('../../utils/validators');
const { getAiModeForMessage } = require("../../utils/aiModeResolver");
const { parseAIResponse } = require("../../utils/aiResponseParser");
const { sanitizeAiData } = require("../../utils/sanitizeAiData");
const { createChatbotGuard } = require("../../services/chatbot/chatbotGuard");

function normalizeText(value) {
    return String(value || "").trim();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ask")
        .setDescription("Tanya HYPEBOTX (chat CS Hyperindo bound).")
        .addStringOption((opt) =>
            opt.setName("question")
                .setDescription("Contoh: cara order joki, status order HYP-0007, price windows key, coupon, refund")
                .setRequired(true),
        ),

    async execute(interaction, client) {
        const questionRaw = sanitizeText(interaction.options.getString("question", true), 500);
        const question = normalizeText(questionRaw);

        // ACK dulu supaya interaction tidak expire saat proses AI
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        // Deterministic resolver for store owner to avoid AI hallucination
        const { tryResolveOwnerAnswer } = require("../../utils/storeOwnerResolver");
        const ownerAnswer = await tryResolveOwnerAnswer({ guild: interaction.guild, question });
        if (ownerAnswer) {
            return interaction.editReply({ content: ownerAnswer });
        }

        try {
            const chatbotService = client.container.services.chatbotService;
            if (!chatbotService?.answer) {
                return interaction.editReply({ content: "Layanan chatbot belum tersedia ya kak. Aku arahkan ke admin ya." });
            }

            const mode = getAiModeForMessage(interaction);
            const chatbotResult = await chatbotService.answer({ interaction, question, questionRaw, mode });

            if (chatbotResult?.ok && chatbotResult.status === "answered" && chatbotResult.answer) {
                return interaction.editReply({ content: chatbotResult.answer });
            }

            const shouldUseAi = chatbotResult && ["not_found", "admin_required"].includes(chatbotResult.status);
            if (!shouldUseAi) {
                return interaction.editReply({ content: chatbotResult?.message || "Datanya belum ketemu kak, aku arahkan ke admin ya." });
            }

            const aiToolScannerService = client.container.services.aiToolScannerService;
            const scanResult = await aiToolScannerService?.scan?.({
                client,
                guild: interaction.guild,
                channel: interaction.channel,
                user: interaction.user,
                question,
                mode,
            });

            const scanJson = scanResult && scanResult.ok
                ? JSON.stringify(sanitizeAiData(scanResult), null, 2)
                : JSON.stringify({ data: {}, sources: [], warnings: [] }, null, 2);

            if ((!scanResult || !scanResult.ok) && !isGeneralQuestion) {
                return interaction.editReply({ content: "Datanya belum ada di sistem kak, aku arahkan ke admin ya." });
            }
            const prompt = `Kamu adalah HYPEBOTX, assistant resmi Hyper Indo.\n\nATURAN WAJIB:\n- Jawab hanya berdasarkan TOOL_SCAN_RESULT.\n- Jangan mengarang harga, owner, co-owner, antrian, status order, status payment, refund, warranty, atau policy.\n- Kalau data tidak ada di TOOL_SCAN_RESULT, jawab: \"Datanya belum ada di sistem kak, aku arahkan ke admin ya.\"\n- Jangan tampilkan token, API key, webhook, password, cookie, session, atau secret.\n- Jangan meminta customer mengirim password di channel publik.\n- Jika data sensitif/order/payment tidak tersedia di ticket context, arahkan ke admin.\n- Jawab singkat, sopan, dan jelas dalam bahasa Indonesia.\n\nTOOL_SCAN_RESULT:\n${scanJson}\n\nUser question: ${question}\n\nBerikan jawaban dalam format JSON saja, tanpa penjelasan tambahan:\n{\n  \"answer\": \"string\",\n  \"confidence\": \"high|medium|low\",\n  \"source\": [\"database:pricelist\"],\n  \"needsAdmin\": false\n}`;

            const aiService = client.container.services.aiService;
            const guard = createChatbotGuard({ client });
            const isGeneralQuestion = guard.isLikelyGeneralQuestion(questionRaw);
            const promptTemplate = isGeneralQuestion
                ? `Kamu adalah HYPEBOTX, assistant resmi Hyper Indo. Jawab pertanyaan user dengan santun, jelas, dan singkat dalam bahasa Indonesia. Gunakan TOOL_SCAN_RESULT hanya jika relevan. Jika pertanyaan bukan tentang store/joki/payment/invoice/order, kamu boleh menjawab berdasarkan pengetahuan umum. Jika kamu tidak tahu, jawab: "Maaf kak, aku belum tahu tentang itu." Jangan mengarang informasi sensitif atau pribadi. Jangan tampilkan token, API key, webhook, password, cookie, session, atau secret. Jangan sarankan user mengirim data pribadi di channel publik.\n\nTOOL_SCAN_RESULT:\n${scanJson}\n\nUser question: ${question}\n\nBerikan jawaban dalam format JSON saja, tanpa penjelasan tambahan:\n{\n  "answer": "string",\n  "confidence": "high|medium|low",\n  "source": ["database:pricelist"],\n  "needsAdmin": false\n}`
                : `Kamu adalah HYPEBOTX, assistant resmi Hyper Indo.\n\nATURAN WAJIB:\n- Jawab hanya berdasarkan TOOL_SCAN_RESULT.\n- Jangan mengarang harga, owner, co-owner, antrian, status order, status payment, refund, warranty, atau policy.\n- Kalau data tidak ada di TOOL_SCAN_RESULT, jawab: \"Datanya belum ada di sistem kak, aku arahkan ke admin ya.\"\n- Jangan tampilkan token, API key, webhook, password, cookie, session, atau secret.\n- Jangan meminta customer mengirim password di channel publik.\n- Jika data sensitif/order/payment tidak tersedia di ticket context, arahkan ke admin.\n- Jawab singkat, sopan, dan jelas dalam bahasa Indonesia.\n\nTOOL_SCAN_RESULT:\n${scanJson}\n\nUser question: ${question}\n\nBerikan jawaban dalam format JSON saja, tanpa penjelasan tambahan:\n{\n  "answer": "string",\n  "confidence": "high|medium|low",\n  "source": ["database:pricelist"],\n  "needsAdmin": false\n}`;

            const aiResult = await aiService?.processRequest?.(interaction.user.id, promptTemplate, {
                systemPrompt: isGeneralQuestion
                    ? "You are HYPEBOTX, a helpful assistant that answers politely in Indonesian. Use provided context when relevant but feel free to answer general questions based on common knowledge."
                    : "You are HYPEBOTX, a safe and factual assistant that only answers from the provided TOOL_SCAN_RESULT.",
                maxTokens: 700,
                temperature: 0.1,
            }).catch(() => null);

            if (aiResult?.success && aiResult.response) {
                const parsed = parseAIResponse(aiResult.response);
                if (parsed && parsed.answer && parsed.answer.trim()) {
                    if (parsed.needsAdmin === true || String(parsed.confidence || "").toLowerCase() === "low") {
                        return interaction.editReply({ content: "Datanya belum ada di sistem kak, aku arahkan ke admin ya." });
                    }
                    return interaction.editReply({ content: parsed.answer.trim() });
                }
            }

            return interaction.editReply({ content: "Datanya belum ada di sistem kak, aku arahkan ke admin ya." });
        } catch (error) {
            const logger = client.container.logger;
            if (logger?.error) logger.error("[ASK] unexpected error:", error?.message || String(error));
            return interaction.editReply({ content: "Datanya belum ketemu kak, aku arahkan ke admin ya." });
        }
    },
};
