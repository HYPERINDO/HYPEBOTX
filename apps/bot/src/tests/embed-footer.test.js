const test = require("node:test");
const assert = require("node:assert/strict");

const { createEmbed } = require("../utils/embed");

test("createEmbed supports object footer without rendering [object Object]", () => {
  const embed = createEmbed({
    title: "Test",
    description: "Footer check",
    footer: { text: "HYPEBOTX - Ticketing System" },
  });

  const json = embed.toJSON();
  assert.equal(json?.footer?.text, "HYPEBOTX - Ticketing System");
});

test("createEmbed object values never render [object Object]", () => {
  const embed = createEmbed({
    title: { text: "Ticket Summary" },
    description: { status: "pending", ticket: 42 },
    fields: [
      { name: "Meta", value: { source: "button", ok: true } },
    ],
  });

  const json = embed.toJSON();
  assert.equal(String(json?.title || "").includes("[object Object]"), false);
  assert.equal(String(json?.description || "").includes("[object Object]"), false);
  assert.equal(String(json?.fields?.[0]?.value || "").includes("[object Object]"), false);
});
