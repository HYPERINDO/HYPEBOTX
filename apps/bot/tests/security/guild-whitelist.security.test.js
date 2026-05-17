const test = require("node:test");
const assert = require("node:assert/strict");
const { Events } = require("discord.js");
const { extractGuildIdFromEventArgs, isGuildAllowed } = require("../../src/utils/guildGuard");

test("security: extract guild id from event args", () => {
    const guildId = extractGuildIdFromEventArgs([
        { channel: { guild: { id: "123" } } },
        { member: { guild: { id: "456" } } },
    ]);

    assert.equal(guildId, "123");
});

test("security: block disallowed guild event", () => {
    const botConfig = { allowedGuildIds: ["allowed-guild"] };
    const result = isGuildAllowed(botConfig, Events.MessageCreate, [
        { guild: { id: "not-allowed" } },
    ]);

    assert.equal(result, false);
});

test("security: allow event when guild whitelist is empty", () => {
    const botConfig = { allowedGuildIds: [] };
    const result = isGuildAllowed(botConfig, Events.MessageCreate, [
        { guild: { id: "any-guild" } },
    ]);

    assert.equal(result, true);
});

test("security: allow guildCreate event regardless of whitelist", () => {
    const botConfig = { allowedGuildIds: ["allowed-guild"] };
    const result = isGuildAllowed(botConfig, Events.GuildCreate, [
        { id: "not-allowed" },
    ]);

    assert.equal(result, true);
});

