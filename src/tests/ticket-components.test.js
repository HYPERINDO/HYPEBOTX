const test = require("node:test");
const assert = require("node:assert/strict");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const { mergeActionRows } = require("../services/ticketService");

function createRow(customIds) {
  return new ActionRowBuilder().addComponents(
    ...customIds.map((customId) =>
      new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(customId)
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

test("mergeActionRows keeps components within Discord row limit", () => {
  const rowA = createRow(["flow:payment"]);
  const rowB = createRow(["nav:back", "nav:repeat", "nav:admin"]);

  const merged = mergeActionRows(rowA, rowB);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].components.length, 4);
  assert.deepEqual(
    merged[0].components.map((component) => component.data.custom_id),
    ["flow:payment", "nav:back", "nav:repeat", "nav:admin"],
  );
});

test("mergeActionRows splits rows when combined components exceed five", () => {
  const rowA = createRow(["a1", "a2", "a3"]);
  const rowB = createRow(["b1", "b2", "b3", "b4"]);

  const merged = mergeActionRows(rowA, rowB);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].components.length, 5);
  assert.equal(merged[1].components.length, 2);
});
