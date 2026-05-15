const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createTestDatabase,
  createAllRepositories,
  createFakeGuild,
  createFakeMember,
} = require("./helpers");

const { createBacklogService } = require("../../src/services/backlogService");

test("coupon business logic: negative total prevention and valid redemptions", async () => {
  const { database } = createTestDatabase("coupon-biz");
  const repositories = createAllRepositories(database);
  const guild = createFakeGuild();
  
  const backlogService = createBacklogService({
    repositories,
    logger: { info() {}, warn() {}, error() {} },
    loggingService: null,
    statusSyncService: null
  });

  // Setup Coupons
  await backlogService.createCoupon({
    guildId: guild.id,
    code: "OVERKILL",
    discountType: "amount",
    discountValue: 150000,
    maxRedemptions: 10,
    createdBy: "admin"
  });

  // Setup Order
  await repositories.orderRepository.create({
    id: "ORD-C1",
    guildId: guild.id,
    price: "100000",
    userId: "u-1"
  });

  // Redeem
  const result = await backlogService.redeemCoupon({
    guildId: guild.id,
    userId: "u-1",
    orderId: "ORD-C1",
    code: "OVERKILL"
  });

  assert.equal(result.ok, true);
  // Original price 100k, discount 150k -> discount applied should be capped at 100k
  // The system should not create a negative total (subtotal 100k - discount 150k = -50k)
  assert.equal(result.redemption.discountAmount, 100000, "Discount must be capped to order price to prevent negative total");
});
