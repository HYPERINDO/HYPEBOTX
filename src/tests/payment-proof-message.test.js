const test = require("node:test");
const assert = require("node:assert/strict");

const { createPaymentService } = require("../services/paymentService");

test("payment proof image in order ticket creates submitted payment", async () => {
  const payments = [];
  const ticketUpdates = [];
  const orderUpdates = [];
  const logEntries = [];
  const replies = [];
  const reactions = [];

  const service = createPaymentService({
    botConfig: {
      storeName: "HYPERINDO",
      payment: { bank: "", ewallet: "", qris: "" },
    },
    logger: { info() {}, warn() {} },
    repositories: {
      simpleStoreRepository: { async getSettings() { return {}; } },
      ticketRepository: {
        async findByChannelId(channelId) {
          assert.equal(channelId, "ticket-channel-1");
          return { id: "0001", type: "order", openerId: "user-1" };
        },
        async update(ticketId, changes) {
          ticketUpdates.push({ ticketId, changes });
        },
      },
      orderRepository: {
        async updateByTicketId(ticketId, changes) {
          orderUpdates.push({ ticketId, changes });
        },
      },
      paymentRepository: {
        async create(payment) {
          payments.push(payment);
          return payment;
        },
      },
    },
    loggingService: {
      async logPayment(guild, title, description, fields) {
        logEntries.push({ guild, title, description, fields });
      },
    },
  });

  const message = {
    id: "message-1",
    guild: { id: "guild-1" },
    channel: { id: "ticket-channel-1" },
    author: { id: "user-1", bot: false, tag: "buyer#0001" },
    member: { roles: { cache: { some() { return false; } } }, permissions: { has() { return false; } } },
    content: "",
    attachments: new Map([
      ["proof-1", { url: "https://cdn.example/proof.png", name: "proof.png", contentType: "image/png" }],
    ]),
    inGuild() {
      return true;
    },
    async react(value) {
      reactions.push(value);
    },
    async reply(value) {
      replies.push(value);
    },
  };

  const payment = await service.handlePaymentProofMessage(message);

  assert.equal(payment.ticketId, "0001");
  assert.equal(payment.status, "submitted");
  assert.equal(payment.method, "image-proof");
  assert.deepEqual(payment.proofUrls, ["https://cdn.example/proof.png"]);
  assert.equal(payments.length, 1);
  assert.deepEqual(ticketUpdates, [{ ticketId: "0001", changes: { orderStatus: "waiting" } }]);
  assert.deepEqual(orderUpdates, [
    { ticketId: "0001", changes: { status: "waiting" } },
    { ticketId: "0001", changes: { paymentStatus: "submitted" } },
  ]);
  assert.equal(logEntries.length, 1);
  assert.deepEqual(reactions, ["✅"]);
  assert.equal(replies.length, 1);
});
