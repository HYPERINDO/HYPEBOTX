const assert = require("node:assert");
const { describe, test } = require("node:test");
const { safeReply, safeEditReply } = require("../utils/interactionReply");

describe("interactionReply utility", () => {
    test("safeReply uses reply for fresh interactions", async () => {
        const calls = [];
        const interaction = {
            deferred: false,
            replied: false,
            reply: async (payload) => {
                calls.push({ method: "reply", payload });
                return payload;
            },
            followUp: async () => {
                calls.push({ method: "followUp" });
                return null;
            },
        };

        const response = await safeReply(interaction, "Hello world", { flags: 64 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, "reply");
        assert.deepStrictEqual(calls[0].payload, { content: "Hello world", flags: 64 });
        assert.strictEqual(response, "Hello world");
    });

    test("safeReply uses followUp when interaction is deferred", async () => {
        const calls = [];
        const interaction = {
            deferred: true,
            replied: false,
            reply: async () => {
                calls.push({ method: "reply" });
                return null;
            },
            followUp: async (payload) => {
                calls.push({ method: "followUp", payload });
                return payload;
            },
        };

        const response = await safeReply(interaction, { content: "Delayed reply", flags: 64 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, "followUp");
        assert.deepStrictEqual(calls[0].payload, { content: "Delayed reply", flags: 64 });
        assert.strictEqual(response, "Delayed reply");
    });

    test("safeEditReply replies when not deferred and edits when deferred", async () => {
        const calls = [];

        const freshInteraction = {
            deferred: false,
            replied: false,
            reply: async (payload) => {
                calls.push({ method: "reply", payload });
                return payload;
            },
            editReply: async (payload) => {
                calls.push({ method: "editReply", payload });
                return payload;
            },
        };

        const initial = await safeEditReply(freshInteraction, "First reply", { flags: 64 });
        assert.deepStrictEqual(initial, { content: "First reply", flags: 64 });
        assert.strictEqual(calls[0].method, "reply");
        assert.deepStrictEqual(calls[0].payload, { content: "First reply", flags: 64 });

        const deferredInteraction = {
            deferred: true,
            replied: false,
            reply: async () => {
                throw new Error("should not reply");
            },
            editReply: async (payload) => {
                calls.push({ method: "editReply", payload });
                return payload;
            },
        };

        const edited = await safeEditReply(deferredInteraction, "Edited reply", { flags: 64 });
        assert.deepStrictEqual(edited, { content: "Edited reply", flags: 64 });
        assert.strictEqual(calls[1].method, "editReply");
        assert.deepStrictEqual(calls[1].payload, { content: "Edited reply", flags: 64 });
    });
});
