const test = require("node:test");
const assert = require("node:assert/strict");

const { createWebDashboardService } = require("../services/webDashboardService");

function createService() {
  return createWebDashboardService({
    botConfig: { clientId: "client-1", guildId: "guild-1" },
    logger: { info() {}, warn() {}, error() {} },
    services: {
      backlogService: {
        async getHealthSnapshot() {
          return { ok: true, runtime: { openTickets: 1 } };
        },
      },
    },
    repositories: {
      ticketRepository: {
        async getAllByGuildId() {
          return [{ id: "T-1", guildId: "guild-1", status: "open" }];
        },
      },
      orderRepository: {
        async getAllByGuildId() {
          return [
            { id: "O-1", guildId: "guild-1", status: "pending", price: "Rp100.000" },
            { id: "O-2", guildId: "guild-1", status: "completed", price: "Rp200.000" },
          ];
        },
      },
      paymentRepository: {
        async getAll() {
          return [
            { id: "P-1", guildId: "guild-1", status: "paid", amount: "100000" },
            { id: "P-2", guildId: "guild-1", status: "submitted", amount: "200000" },
            { id: "P-X", guildId: "guild-x", status: "submitted", amount: "999999" },
          ];
        },
      },
      jokiRepository: {
        async listQueues() {
          return [{ guildId: "guild-1", orders: [{ id: "J-1", status: "processing" }] }];
        },
      },
      userRepository: {
        async getAll() {
          return [{ guildId: "guild-1", userId: "U-1", totalOrder: 2 }];
        },
      },
      stockRepository: {
        stockItems: {
          async getAll() {
            return [{ id: "S-1", guildId: "guild-1", name: "Rockstar Account" }];
          },
        },
        stockUnits: {
          async getAll() {
            return [
              { guildId: "guild-1", itemId: "S-1", status: "available" },
              { guildId: "guild-1", itemId: "S-1", status: "sold" },
            ];
          },
        },
      },
      opsRepository: {
        coupons: {
          async getAll() {
            return [{ guildId: "guild-1", code: "HYPE10" }];
          },
        },
      },
    },
  });
}

test("web dashboard access matrix unifies owner admin and penjoki", () => {
  const service = createService();
  const { canAccess } = service._private;

  assert.equal(canAccess("owner", "owner"), true);
  assert.equal(canAccess("owner", "joki"), true);
  assert.equal(canAccess("admin", "orders"), true);
  assert.equal(canAccess("admin", "owner"), false);
  assert.equal(canAccess("penjoki", "joki"), true);
  assert.equal(canAccess("penjoki", "orders"), false);
});

test("web dashboard data aggregates scoped commerce metrics", async () => {
  const service = createService();
  const data = await service._private.getDashboardData("guild-1");

  assert.equal(data.overview.ordersTotal, 2);
  assert.equal(data.overview.ordersPending, 1);
  assert.equal(data.overview.paymentsPending, 1);
  assert.equal(data.overview.revenue, 100000);
  assert.equal(data.overview.activeJoki, 1);
  assert.equal(data.overview.stockAvailable, 1);
  assert.equal(data.stock[0].available, 1);
  assert.equal(data.stock[0].sold, 1);
});

test("web dashboard cookie parser reads session token", () => {
  const service = createService();
  const parsed = service._private.parseCookie("foo=bar; hypebotx_dashboard=session-token; theme=light");
  assert.equal(parsed.hypebotx_dashboard, "session-token");
});
