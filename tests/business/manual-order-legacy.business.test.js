const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createTestDatabase,
  createAllRepositories,
  createFakeGuild,
  createFakeInteraction,
} = require("./helpers");

const SetOrderHeistCommand = require("../../src/commands/admin/setOrderHeist");

test("set-order-heist fallback searches legacy/manual orders", async () => {
  const { database } = createTestDatabase("set-heist");
  const repositories = createAllRepositories(database);
  const guild = createFakeGuild();

  // Create an active queue order with ONLY customer name in label (legacy scenario)
  await repositories.jokiRepository.addToQueue(guild.id, {
    id: "J-001",
    orderLabel: "🎮 LEGACY\nOldCustomer\nORDER ID: -", // No order ID
  });

  const interaction = createFakeInteraction({
    guildId: guild.id,
    roles: ["OWNER"],
    isOwner: true,
    options: {
      order_id: "OldCustomer", // Match by customer name
      total_heist: 100,
      completed_heist: 70,
      daily_limit_heist: 20
    }
  });

  // Mock client container
  const client = { container: { repositories } };

  await SetOrderHeistCommand.execute(interaction, client);

  // NOTE: interaction.replied tidak update otomatis di mock; pakai last reply content sebagai sumber kebenaran.
  assert.match(interaction._lastReplyContent, /Heist set OK/i);

  const queue = await repositories.jokiRepository.getQueue(guild.id);
  const order = queue.orders[0];
  
  assert.equal(order.totalHeist, 100);
  assert.equal(order.completedHeist, 70);
  assert.equal(order.remainingHeist, 30);
  assert.equal(order.dailyLimitHeist, 20);
});

function createSilentLogger() {
  return { info() {}, warn() {}, error() {}, debug() {} };
}
