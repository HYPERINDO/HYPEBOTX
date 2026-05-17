const test = require("node:test");
const assert = require("node:assert/strict");

const { createPaymentService } = require("../services/paymentService");
const { componentIds } = require("../utils/constants");

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
  assert.deepEqual(ticketUpdates, [
    { ticketId: "0001", changes: { orderStatus: "waiting" } },
    {
      ticketId: "0001",
      changes: {
        meta: {
          orderFlowStatus: "MENUNGGU KONFIRMASI",
        },
      },
    },
  ]);
  assert.deepEqual(orderUpdates, [
    { ticketId: "0001", changes: { status: "waiting" } },
    { ticketId: "0001", changes: { paymentStatus: "submitted" } },
  ]);
  assert.equal(logEntries.length, 1);
  assert.deepEqual(reactions, ["✅"]);
  assert.equal(replies.length, 1);
  const confirmButton = replies[0]?.components?.[0]?.components?.[0];
  assert.equal(confirmButton?.data?.custom_id, `${componentIds.paymentApprovePrefix}0001`);
});

test("payment proof blocked while waiting admin includes admin confirm button", async () => {
  const replies = [];
  const service = createPaymentService({
    botConfig: {
      storeName: "HYPERINDO",
      payment: { bank: "", ewallet: "", qris: "" },
    },
    logger: { info() {}, warn() {} },
    repositories: {
      ticketRepository: {
        async findByChannelId() {
          return {
            id: "0002",
            type: "order",
            openerId: "user-1",
            meta: {
              checkoutFlowVersion: 2,
              orderFlowStatus: "MENUNGGU ADMIN",
              invoiceReady: true,
            },
          };
        },
      },
      orderRepository: {
        async findByTicketId() {
          return { id: "HYP-0002", checkoutSummary: "ready" };
        },
      },
    },
    loggingService: {},
  });

  const message = {
    guild: { id: "guild-1" },
    channel: { id: "ticket-channel-2" },
    author: { id: "user-1", bot: false, tag: "buyer#0001" },
    member: { roles: { cache: { some() { return false; } } }, permissions: { has() { return false; } } },
    attachments: new Map([
      ["proof-1", { url: "https://cdn.example/proof2.png", name: "proof2.png", contentType: "image/png" }],
    ]),
    inGuild() {
      return true;
    },
    async reply(value) {
      replies.push(value);
    },
  };

  const result = await service.handlePaymentProofMessage(message);
  assert.equal(result, null);
  assert.equal(replies.length, 1);
  assert.equal(typeof replies[0], "object");
  assert.match(String(replies[0].content || ""), /menunggu admin/i);
  const button = replies[0].components?.[0]?.components?.[0];
  assert.equal(button?.data?.custom_id, componentIds.orderAdminConfirm);
});

test("payment proof is forwarded to payment review channel with confirm button", async () => {
  const reviewMessages = [];
  const reviewChannel = {
    id: "1503411881820295251",
    isTextBased() {
      return true;
    },
    async send(payload) {
      reviewMessages.push(payload);
      return { id: "review-message-1" };
    },
  };

  const guild = {
    id: "guild-1",
    channels: {
      cache: new Map([[reviewChannel.id, reviewChannel]]),
      async fetch(channelId) {
        if (channelId === reviewChannel.id) return reviewChannel;
        return null;
      },
    },
  };

  const service = createPaymentService({
    botConfig: {
      storeName: "HYPERINDO",
      payment: { bank: "", ewallet: "", qris: "" },
    },
    logger: { info() {}, warn() {} },
    repositories: {
      simpleStoreRepository: { async getSettings() { return {}; } },
      ticketRepository: {
        async findByChannelId() {
          return {
            id: "0003",
            type: "order",
            openerId: "user-1",
            channelId: "ticket-channel-3",
            meta: {
              checkoutFlowVersion: 2,
              invoiceReady: true,
              orderFlowStatus: "MENUNGGU PEMBAYARAN",
            },
          };
        },
        async update() {},
      },
      orderRepository: {
        async findByTicketId() {
          return {
            id: "HYP-0003",
            product: "Steam",
            packageName: "Steam Rp150.000",
            checkoutSummary: "ready",
          };
        },
        async updateByTicketId() {},
      },
      paymentRepository: {
        async create(payment) {
          return payment;
        },
      },
    },
    loggingService: { async logPayment() {} },
  });

  const message = {
    id: "message-3",
    guild,
    channel: { id: "ticket-channel-3" },
    author: { id: "user-1", bot: false, tag: "buyer#0001" },
    member: { roles: { cache: { some() { return false; } } }, permissions: { has() { return false; } } },
    attachments: new Map([
      ["proof-1", { url: "https://cdn.example/proof3.png", name: "proof3.png", contentType: "image/png" }],
    ]),
    inGuild() {
      return true;
    },
    async react() {},
    async reply() {},
  };

  await service.handlePaymentProofMessage(message);

  assert.equal(reviewMessages.length, 1);
  const confirmButton = reviewMessages[0]?.components?.[0]?.components?.[0];
  assert.equal(confirmButton?.data?.custom_id, `${componentIds.paymentApprovePrefix}0003`);
});

test("duplicate payment proof is blocked and does not create a second payment", async () => {
  const createdPayments = [];
  const replies = [];
  const service = createPaymentService({
    botConfig: {
      storeName: "HYPERINDO",
      payment: { bank: "", ewallet: "", qris: "" },
    },
    logger: { info() {}, warn() {} },
    repositories: {
      ticketRepository: {
        async findByChannelId() {
          return {
            id: "0004",
            type: "order",
            openerId: "user-1",
            meta: { checkoutFlowVersion: 2, invoiceReady: true },
          };
        },
      },
      orderRepository: {
        async findByTicketId() {
          return { id: "HYP-0004", checkoutSummary: "ready" };
        },
      },
      paymentRepository: {
        async getAll() {
          return [
            {
              id: "PAY-OLD",
              guildId: "guild-1",
              ticketId: "0004",
              status: "submitted",
              proofUrls: ["https://cdn.example/proof-dup.png"],
            },
          ];
        },
        async create(payment) {
          createdPayments.push(payment);
          return payment;
        },
      },
    },
    loggingService: {
      async logSecurity() {},
      async logPayment() {},
    },
  });

  const message = {
    id: "message-4",
    guild: { id: "guild-1" },
    channel: { id: "ticket-channel-4" },
    author: { id: "user-1", bot: false, tag: "buyer#0001" },
    member: { roles: { cache: { some() { return false; } } }, permissions: { has() { return false; } } },
    attachments: new Map([
      ["proof-dup", { url: "https://cdn.example/proof-dup.png", name: "proof-dup.png", contentType: "image/png" }],
    ]),
    inGuild() {
      return true;
    },
    async reply(value) {
      replies.push(value);
    },
  };

  const result = await service.handlePaymentProofMessage(message);

  assert.equal(result, null);
  assert.equal(createdPayments.length, 0);
  assert.equal(replies.length, 1);
  assert.match(String(replies[0]), /sudah pernah dikirim/i);
});

test("payment approve publishes queue-list update when queue entry exists", async () => {
  const queuePublishes = [];
  const orderUpdates = [];
  const ticketUpdates = [];

  const service = createPaymentService({
    botConfig: {
      storeName: "HYPERINDO",
      payment: { bank: "", ewallet: "", qris: "" },
    },
    logger: { info() {}, warn() {} },
    repositories: {
      paymentRepository: {
        async findByTicketId(ticketId) {
          assert.equal(ticketId, "0010");
          return [
            {
              id: "PAY-0010",
              ticketId: "0010",
              status: "submitted",
              note: "",
            },
          ];
        },
        async updateById() {},
      },
      ticketRepository: {
        async update(ticketId, changes) {
          ticketUpdates.push({ ticketId, changes });
        },
      },
      orderRepository: {
        async updateByTicketId(ticketId, changes) {
          orderUpdates.push({ ticketId, changes });
        },
        async findByTicketId() {
          return null;
        },
      },
      jokiRepository: {
        async getOrderById(guildId, queueId) {
          assert.equal(guildId, "guild-10");
          assert.equal(queueId, "Q-10");
          return { id: "Q-10", status: "queued" };
        },
      },
    },
    loggingService: { async logPayment() {} },
    statusSyncService: {
      async syncTicketOrderQueueStatus() {
        return { ok: true, queueOrderId: "Q-10" };
      },
    },
    getJokiService: () => ({
      async publishQueueUpdate(guild, order, action) {
        queuePublishes.push({ guildId: guild.id, orderId: order.id, action });
      },
    }),
    deliveryService: null,
    orderService: null,
  });

  const interaction = {
    guild: { id: "guild-10" },
    user: { id: "staff-10", tag: "staff#0010" },
    channel: { id: "review-channel-10", isTextBased() { return true; } },
  };

  const relatedTicket = {
    id: "0010",
    channelId: "ticket-channel-10",
    meta: { formType: "joki" },
  };

  const result = await service.approvePaymentFromTicketId(interaction, relatedTicket, "0010");
  assert.equal(result?.ok, true);
  assert.equal(queuePublishes.length, 1);
  assert.deepEqual(queuePublishes[0], {
    guildId: "guild-10",
    orderId: "Q-10",
    action: "payment-accepted",
  });
  assert.ok(ticketUpdates.length >= 1);
  assert.ok(orderUpdates.length >= 1);
});
