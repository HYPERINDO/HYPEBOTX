const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAIContext } = require("../utils/aiContextBuilder");

test("ai context builder loads panduan snippets from docs path", async () => {
  const client = {
    container: {
      services: {
        storeOpsService: {
          async getPriceList() {
            return [];
          },
        },
      },
    },
    guilds: {
      cache: new Map(),
    },
  };

  const context = await buildAIContext({
    client,
    guildId: "guild-1",
  });

  assert.equal(typeof context, "string");
  assert.equal(context.includes("Catatan keamanan"), true);
  assert.equal(context.includes("Panduan/commands penting:"), true);
});
