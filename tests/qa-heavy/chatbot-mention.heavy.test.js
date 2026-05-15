const test = require("node:test");
const assert = require("node:assert/strict");

const mentionEvent = require("../../src/events/guild/messageCreate");

function createClient({ botId = "bot-1" } = {}) {
    const replies = [];
    const client = {
        user: { id: botId },
        container: {
            botConfig: {
                chatbot: {
                    enabled: true,
                    cooldownMs: 0,
                    maxQuestionLength: 500,
                },
            },
            services: {
                paymentService: { handlePaymentProofMessage: async () => null },
                backlogService: { handleSensitiveDataWarning: async () => false },
                moderationService: { handleMessage: async () => { } },
                chatbotService: {
                    answer: async ({ question }) => {
                        // Just echo a safe stub
                        return { ok: true, status: "answered", answer: `ANSWER: ${question}` };
                    },
                },
            },
            logger: { warn() { }, error() { } },
        },
        _chatbotCooldowns: new Map(),
    };

    return {
        client,
        replies,
    };
}

function createMessage({ client, content, mentionsHasBot = true, channelName = "open-ticket" } = {}) {
    const message = {
        inGuild: () => true,
        content,
        author: { id: "u-1", bot: false },
        guild: { id: "g-1", ownerId: "owner" },
        member: null,
        webhookId: null,
        channel: { name: channelName },
        mentions: { users: { has: (id) => mentionsHasBot && id === client.user.id } },
        reply: async (payload) => {
            // store replies for assertions
            if (!client._replies) client._replies = [];
            client._replies.push(payload);
            return payload;
        },
    };
    return message;
}

test("chatbot mention: empty mention after stripping mention -> greeting", async () => {
    const { client } = createClient({ botId: "bot-1" });
    const msg = createMessage({ client, content: `<@bot-1>` });

    await mentionEvent.execute(client, msg);

    const replies = client._replies || [];
    assert.ok(replies.length >= 1, "should reply");
    const last = replies[replies.length - 1];
    const text = typeof last === "string" ? last : (last?.content || "");
    assert.match(String(text), /Halo kak/i);
});

test("chatbot mention: status order mention triggers chatbotService", async () => {
    const { client } = createClient({ botId: "bot-1" });
    const msg = createMessage({ client, content: `<@bot-1> status order ORD-0001` });

    await mentionEvent.execute(client, msg);

    const replies = client._replies || [];
    assert.ok(replies.length >= 1, "should reply");
    const last = replies[replies.length - 1];
    const text = typeof last === "string" ? last : (last?.content || "");
    assert.match(String(text), /ANSWER:/i);
    assert.match(String(text), /status order ORD-0001/i);
});
