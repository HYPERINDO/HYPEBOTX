const test = require("node:test");
const assert = require("node:assert/strict");

const { createOrderService } = require("../services/orderService");
const { componentIds } = require("../utils/constants");

function createMockChannel(id) {
  let messageCounter = 0;
  const store = new Map();

  return {
    id,
    sent: [],
    isTextBased() {
      return true;
    },
    messages: {
      async fetch(ref) {
        if (typeof ref === "string") {
          return store.get(ref) || null;
        }
        return {
          filter() {
            return {
              sort() {
                return {
                  size: 0,
                  values() {
                    return [];
                  },
                };
              },
            };
          },
        };
      },
    },
    async send(payload) {
      messageCounter += 1;
      const messageId = `${id}-msg-${messageCounter}`;
      const message = {
        id: messageId,
        editable: true,
        deleted: false,
        createdTimestamp: Date.now(),
        author: { bot: true },
        embeds: payload?.embeds || [],
        components: payload?.components || [],
        async edit(nextPayload) {
          this.embeds = nextPayload?.embeds || [];
          this.components = nextPayload?.components || [];
          return this;
        },
        async delete() {
          this.deleted = true;
          store.delete(messageId);
          return null;
        },
      };
      store.set(messageId, message);
      this.sent.push({ id: messageId, payload });
      return message;
    },
  };
}

function createInMemoryRepos() {
  const tickets = [];
  const orders = [];
  let orderCounter = 0;

  return {
    state: { tickets, orders },
    repositories: {
      ticketRepository: {
        async findByChannelId(channelId) {
          return tickets.find((ticket) => ticket.channelId === channelId) || null;
        },
        async findById(id) {
          return tickets.find((ticket) => ticket.id === id) || null;
        },
        async create(ticket) {
          tickets.push({ ...ticket });
          return ticket;
        },
        async update(id, changes) {
          const index = tickets.findIndex((ticket) => ticket.id === id);
          if (index < 0) return null;
          tickets[index] = { ...tickets[index], ...changes };
          return tickets[index];
        },
        async getAll() {
          return [...tickets];
        },
      },
      orderRepository: {
        async findByTicketId(ticketId) {
          return orders.find((order) => order.ticketId === ticketId) || null;
        },
        async findById(orderId) {
          return orders.find((order) => order.id === orderId) || null;
        },
        async create(order) {
          orders.push({ ...order });
          return order;
        },
        async updateById(orderId, changes) {
          const index = orders.findIndex((order) => order.id === orderId);
          if (index < 0) return null;
          orders[index] = { ...orders[index], ...changes };
          return orders[index];
        },
        async updateByTicketId(ticketId, changes) {
          const index = orders.findIndex((order) => order.ticketId === ticketId);
          if (index < 0) return null;
          orders[index] = { ...orders[index], ...changes };
          return orders[index];
        },
        async findByUserId() {
          return [...orders];
        },
      },
      simpleStoreRepository: {
        async getNextOrderId() {
          orderCounter += 1;
          return `HYPE-${String(orderCounter).padStart(4, "0")}`;
        },
      },
      userRepository: {
        async incrementOrder() {
          return null;
        },
      },
    },
  };
}

function createInteractionBase({ guild, channel, userId = "user-1" }) {
  const dmStore = new Map();
  const dms = [];
  const user = {
    id: userId,
    tag: `${userId}#0001`,
    username: userId,
    async createDM() {
      return {
        messages: {
          async fetch(messageId) {
            return dmStore.get(messageId) || null;
          },
        },
      };
    },
    async send(payload) {
      const id = `dm-${dms.length + 1}`;
      const message = {
        id,
        editable: true,
        embeds: payload?.embeds || [],
        async edit(nextPayload) {
          this.embeds = nextPayload?.embeds || [];
          return this;
        },
      };
      dmStore.set(id, message);
      dms.push({ id, payload });
      return message;
    },
  };

  return {
    guild,
    member: { id: `member-${userId}`, user },
    user,
    channel,
    replied: false,
    deferred: false,
    followUps: [],
    updates: [],
    edits: [],
    modals: [],
    dms,
    async deferUpdate() {
      this.deferred = true;
      return null;
    },
    async reply(payload) {
      this.replied = true;
      this.lastReply = payload;
      return payload;
    },
    async editReply(payload) {
      this.edits.push(payload);
      this.lastEditReply = payload;
      return payload;
    },
    async followUp(payload) {
      this.followUps.push(payload);
      return payload;
    },
    async update(payload) {
      this.updates.push(payload);
      this.lastUpdate = payload;
      return payload;
    },
    async showModal(modal) {
      this.modals.push(modal);
      this.lastModal = modal;
      return modal;
    },
  };
}

function createTextInputFields(values) {
  return {
    getTextInputValue(id) {
      if (Object.prototype.hasOwnProperty.call(values, id)) {
        return values[id];
      }
      throw new Error(`Missing field ${id}`);
    },
  };
}

async function runCheckoutScenario({
  service,
  guild,
  panelChannel,
  state,
  serviceValue,
  productValue,
  packageValue,
  modalCustomId,
  modalValues,
  methodValue = null,
  modalAfterMethod = false,
  paymentValue = "qris",
}) {
  const starter = createInteractionBase({ guild, channel: panelChannel });
  const starterResult = await service.startCheckoutFromPanel(starter);
  const panelMessageId = starterResult?.draft?.messageId;
  assert.ok(panelMessageId);

  assert.equal(state.tickets.length, 0, "ticket tidak boleh dibuat sebelum confirm");

  const serviceSelect = createInteractionBase({ guild, channel: panelChannel });
  serviceSelect.customId = componentIds.orderServiceSelect;
  serviceSelect.values = [serviceValue];
  serviceSelect.message = { id: panelMessageId };
  await service.handleCheckoutSelectInteraction(serviceSelect);

  const productSelect = createInteractionBase({ guild, channel: panelChannel });
  productSelect.customId = componentIds.orderProductSelect;
  productSelect.values = [productValue];
  productSelect.message = { id: panelMessageId };
  await service.handleCheckoutSelectInteraction(productSelect);

  const packageSelect = createInteractionBase({ guild, channel: panelChannel });
  packageSelect.customId = componentIds.orderPackageSelect;
  packageSelect.values = [packageValue];
  packageSelect.message = { id: panelMessageId };
  await service.handleCheckoutSelectInteraction(packageSelect);

  if (methodValue && modalAfterMethod) {
    const methodSelect = createInteractionBase({ guild, channel: panelChannel });
    methodSelect.customId = componentIds.orderMethodSelect;
    methodSelect.values = [methodValue];
    methodSelect.message = { id: panelMessageId };
    await service.handleCheckoutSelectInteraction(methodSelect);
  }

  const modalInteraction = createInteractionBase({ guild, channel: panelChannel });
  modalInteraction.customId = modalCustomId;
  modalInteraction.fields = createTextInputFields(modalValues);
  await service.handleCheckoutModalInteraction(modalInteraction);

  if (methodValue && !modalAfterMethod) {
    const methodSelect = createInteractionBase({ guild, channel: panelChannel });
    methodSelect.customId = componentIds.orderMethodSelect;
    methodSelect.values = [methodValue];
    methodSelect.message = { id: panelMessageId };
    await service.handleCheckoutSelectInteraction(methodSelect);
  }

  const paymentSelect = createInteractionBase({ guild, channel: panelChannel });
  paymentSelect.customId = componentIds.orderPaymentSelect;
  paymentSelect.values = [paymentValue];
  paymentSelect.message = { id: panelMessageId };
  await service.handleCheckoutSelectInteraction(paymentSelect);

  const confirmButton = createInteractionBase({ guild, channel: panelChannel });
  confirmButton.customId = componentIds.orderConfirmInvoice;
  confirmButton.message = { id: panelMessageId };
  const finalized = await service.handleCheckoutControlButton(confirmButton);

  assert.ok(finalized?.ticket?.id, "ticket harus dibuat saat confirm");
  assert.equal(state.tickets.length, 1, "ticket harus dibuat tepat satu");
  assert.equal(state.orders.length, 1, "order harus dibuat tepat satu");

  return {
    finalized,
    order: state.orders[0],
    ticket: state.tickets[0],
    confirmButton,
    panelMessageId,
  };
}

function createOrderServiceFixture() {
  const panelChannel = createMockChannel("panel-channel");
  const { repositories, state } = createInMemoryRepos();

  let ticketCounter = 0;
  const ticketChannels = [];

  const ticketService = {
    async createTicketChannel(guild, opener, type, meta = {}) {
      ticketCounter += 1;
      const ticketId = String(ticketCounter).padStart(4, "0");
      const channel = createMockChannel(`ticket-channel-${ticketId}`);
      ticketChannels.push(channel);
      const ticket = {
        id: ticketId,
        guildId: guild.id,
        channelId: channel.id,
        openerId: opener.id,
        type,
        status: "open",
        orderStatus: "pending",
        meta,
      };
      await repositories.ticketRepository.create(ticket);
      return { ticket, channel, reused: false };
    },
    async closeTicket() {
      return null;
    },
  };

  const service = createOrderService({
    botConfig: { storeName: "HYPEBOTX" },
    logger: { info() {}, warn() {}, error() {} },
    repositories,
    ticketService,
    roleService: {},
    loggingService: {
      async logOrder() {},
      async logPayment() {},
      async logSecurity() {},
      async logTicket() {},
    },
    getJokiService: () => null,
    statusSyncService: null,
  });

  return {
    service,
    panelChannel,
    state,
    ticketChannels,
    guild: { id: "guild-1", name: "Guild One" },
  };
}

test("checkout produk digital windows/office -> ticket + harga fix", async () => {
  const fixture = createOrderServiceFixture();
  const result = await runCheckoutScenario({
    ...fixture,
    serviceValue: "produk_digital",
    productValue: "windows_office",
    packageValue: "windows_office_package",
    modalCustomId: componentIds.orderWindowsModal,
    modalValues: {
      customer_name: "Andi",
      version_name: "Windows 11 Pro",
      need_type: "Aktivasi",
      device_name: "Laptop Asus",
      notes: "Remote malam",
    },
  });

  assert.equal(result.order.service, "Produk Digital");
  assert.match(result.order.checkoutSummary, /Harga: Mulai Rp50\.000/);
  assert.match(result.order.checkoutSummary, /Status: MENUNGGU PEMBAYARAN/);
});

test("checkout produk digital game account epic/rockstar/steam pakai harga kategori tanpa dobel pricelist", async () => {
  const scenarios = [
    { value: "epic_games", price: "Mulai Rp180.000++", block: /Produk\/Paket: Rockstar -|Produk\/Paket: Steam -/ },
    { value: "rockstar", price: "Rp180.000", block: /Produk\/Paket: Epic Games -|Produk\/Paket: Steam -/ },
    { value: "steam", price: "Rp150.000", block: /Produk\/Paket: Epic Games -|Produk\/Paket: Rockstar -/ },
  ];

  for (const scenario of scenarios) {
    const fixture = createOrderServiceFixture();
    const result = await runCheckoutScenario({
      ...fixture,
      serviceValue: "produk_digital",
      productValue: "game_account",
      packageValue: scenario.value,
      modalCustomId: componentIds.orderGameAccountModal,
      modalValues: {
        customer_name: "Budi",
        platform_account: "Steam",
        game_name: "GTA V",
        account_type: "Akun Sesuai Paket",
        budget: "200000",
        notes: "cek stok dulu",
      },
    });

    assert.equal(result.order.service, "Produk Digital");
    const escapedPrice = scenario.price.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(result.order.checkoutSummary, new RegExp(`Harga: ${escapedPrice}`));
    assert.match(result.order.checkoutSummary, /Status: MENUNGGU ADMIN/);
    assert.doesNotMatch(result.order.checkoutSummary, scenario.block);
  }
});

test("checkout topup tetap jalur sendiri dan membuat ticket", async () => {
  const fixture = createOrderServiceFixture();
  const result = await runCheckoutScenario({
    ...fixture,
    serviceValue: "topup",
    productValue: "mobile_legends",
    packageValue: "basic",
    modalCustomId: componentIds.orderTopupModal,
    modalValues: {
      customer_name: "Citra",
      uid_game: "123456",
      username_game: "citraml",
      server_zone: "ID",
      nominal_topup: "86 diamonds",
      notes: "proses cepat",
    },
  });

  assert.equal(result.order.service, "Top Up");
  assert.match(result.order.checkoutSummary, /INVOICE ORDER TOP UP/);
  assert.match(result.order.checkoutSummary, /Status: MENUNGGU PEMBAYARAN/);

  const ticketChannel = fixture.ticketChannels[0];
  assert.ok(ticketChannel, "ticket channel harus tersedia");

  const summaryMessage = ticketChannel.sent
    .map((entry) => entry.payload)
    .find((payload) => String(payload?.embeds?.[0]?.data?.title || "").includes("ORDER SUMMARY"));

  assert.ok(summaryMessage, "order summary harus terkirim di ticket");
  const confirmButton = summaryMessage.components?.[0]?.components?.[0];
  const serializedButton = typeof confirmButton?.toJSON === "function" ? confirmButton.toJSON() : (confirmButton?.data || {});
  assert.equal(serializedButton.custom_id, componentIds.orderCustomerConfirm);
  assert.match(String(serializedButton.label || ""), /Konfirmasi Order/i);

  const hasInvoiceInTicket = ticketChannel.sent
    .map((entry) => entry.payload)
    .some((payload) => String(payload?.embeds?.[0]?.data?.title || "").includes("Invoice -"));
  assert.equal(hasInvoiceInTicket, false, "invoice checkout tidak boleh dikirim di ticket");

  const dmInvoice = result.confirmButton?.dms?.find((entry) =>
    String(entry?.payload?.embeds?.[0]?.data?.title || "").includes("Invoice -"),
  );
  assert.ok(dmInvoice, "invoice checkout harus dikirim ke DM customer");
});

test("checkout joki tetap jalur sendiri dan wajib metode joki", async () => {
  const fixture = createOrderServiceFixture();
  const result = await runCheckoutScenario({
    ...fixture,
    serviceValue: "joki",
    productValue: "joki_paket",
    packageValue: "paket_saudagar",
    modalCustomId: componentIds.orderJokiModal,
    modalValues: {
      customer_name: "Dion",
      purchase_platform: "Steam",
      launcher_login: "steam_dion | passSteam123",
      rockstar_login: "rockstar_dion | passRockstar456",
      target_order: "rank + money",
    },
    methodValue: "login_akun",
    modalAfterMethod: true,
  });

  assert.equal(result.order.service, "Joki");
  assert.match(result.order.checkoutSummary, /INVOICE ORDER JOKI/);
  assert.match(result.order.checkoutSummary, /Metode Joki: Login Akun/);
  assert.match(result.order.checkoutSummary, /Platform Pembelian: Steam/);
  assert.match(result.order.checkoutSummary, /Harga: Rp89\.000/);
});

test("checkout joki login akun tetap valid saat platform diisi simbol tapi kredensial Rockstar lengkap", async () => {
  const fixture = createOrderServiceFixture();
  const result = await runCheckoutScenario({
    ...fixture,
    serviceValue: "joki",
    productValue: "joki_paket",
    packageValue: "paket_saudagar",
    modalCustomId: componentIds.orderJokiModal,
    modalValues: {
      customer_name: "Dion",
      purchase_platform: "-",
      launcher_login: "-",
      rockstar_login: "rockstar_dion | passRockstar456",
      target_order: "rank + money",
    },
    methodValue: "login_akun",
    modalAfterMethod: true,
  });

  assert.equal(result.order.service, "Joki");
  assert.match(result.order.checkoutSummary, /Metode Joki: Login Akun/);
  assert.match(result.order.checkoutSummary, /Platform Pembelian: Rockstar/);
});

test("checkout joki via invite mabar hanya butuh rockstar id", async () => {
  const fixture = createOrderServiceFixture();
  const result = await runCheckoutScenario({
    ...fixture,
    serviceValue: "joki",
    productValue: "money_heist",
    packageValue: "10x_heist_rp25_000",
    modalCustomId: componentIds.orderJokiModal,
    modalValues: {
      customer_name: "Rama",
      rockstar_id: "rama_rockstar_01",
      target_order: "mabar heist malam ini",
      notes: "legacy",
    },
    methodValue: "via_invite_mabar",
    modalAfterMethod: true,
  });

  assert.equal(result.order.service, "Joki");
  assert.match(result.order.checkoutSummary, /Metode Joki: Via Invite \/ Mabar/);
  assert.match(result.order.checkoutSummary, /Rockstar Username \/ ID: rama_rockstar_01/);
});

test("checkout draft lama yang mismatch service tetap sinkron ke pricelist joki", async () => {
  const fixture = createOrderServiceFixture();
  const ticketChannel = createMockChannel("ticket-channel-legacy");
  const openerId = "user-1";

  fixture.state.tickets.push({
    id: "0052",
    guildId: fixture.guild.id,
    channelId: ticketChannel.id,
    openerId,
    type: "order",
    status: "open",
    orderStatus: "pending",
    meta: {
      checkout: {
        version: 2,
        userId: "user-1",
        guildId: fixture.guild.id,
        channelId: ticketChannel.id,
        step: "package",
        data: {
          serviceKey: "topup",
          serviceLabel: "Joki",
          productValue: "joki_paket",
          productLabel: "GTA V",
          packageValue: "",
          packageLabel: "",
          methodValue: "",
          methodLabel: "",
          needTypeValue: "",
          needTypeLabel: "",
          paymentValue: "",
          paymentLabel: "",
          formData: {},
        },
      },
    },
  });

  const interaction = createInteractionBase({ guild: fixture.guild, channel: ticketChannel, userId: "user-1" });
  const result = await fixture.service.startCheckoutFromOrderTicket(interaction);
  assert.equal(result.ok, true);
  assert.ok(ticketChannel.sent.length >= 1);

  const latestPayload = ticketChannel.sent[ticketChannel.sent.length - 1].payload;
  const selectMenu = latestPayload.components?.[0]?.components?.[0];
  const serializedMenu = typeof selectMenu?.toJSON === "function" ? selectMenu.toJSON() : (selectMenu?.data || {});
  const labels = (serializedMenu.options || []).map((entry) => entry.label);

  assert.ok(labels.some((label) => String(label).includes("Paket Saudagar")));
  assert.ok(!labels.some((label) => String(label).toLowerCase() === "basic"));
});

test("checkout panel awal menampilkan flow yang sesuai step aktual", async () => {
  const fixture = createOrderServiceFixture();
  const starter = createInteractionBase({ guild: fixture.guild, channel: fixture.panelChannel });

  await fixture.service.startCheckoutFromPanel(starter);

  const firstPayload = fixture.panelChannel.sent[0]?.payload;
  const description = String(firstPayload?.embeds?.[0]?.data?.description || "");

  assert.match(description, /Flow: layanan -> kategori\/produk -> paket -> \(metode\/kebutuhan jika diminta\) -> isi form -> pembayaran -> review -> confirm -> ticket\./);
});

test("cancel tetap bisa reset checkout walau sesi pending sudah hilang", async () => {
  const fixture = createOrderServiceFixture();
  const cancelButton = createInteractionBase({ guild: fixture.guild, channel: fixture.panelChannel });
  cancelButton.customId = componentIds.orderCancel;
  cancelButton.message = { id: "stale-checkout-message" };

  await fixture.service.handleCheckoutControlButton(cancelButton);

  assert.equal(cancelButton.updates.length, 1);
  const updatePayload = cancelButton.updates[0];
  const description = String(updatePayload?.embeds?.[0]?.data?.description || "");
  assert.match(description, /Step: \*\*Pilih layanan utama\*\*/);
  assert.match(description, /Flow: layanan -> kategori\/produk -> paket -> \(metode\/kebutuhan jika diminta\) -> isi form -> pembayaran -> review -> confirm -> ticket\./);
});

test("checkout panel dihapus otomatis setelah confirm invoice", async () => {
  const fixture = createOrderServiceFixture();
  const result = await runCheckoutScenario({
    ...fixture,
    serviceValue: "topup",
    productValue: "mobile_legends",
    packageValue: "basic",
    modalCustomId: componentIds.orderTopupModal,
    modalValues: {
      customer_name: "Hana",
      uid_game: "778899",
      username_game: "hanaml",
      server_zone: "ID",
      nominal_topup: "172 diamonds",
      notes: "hapus panel setelah confirm",
    },
  });

  const panelMessage = await fixture.panelChannel.messages.fetch(result.panelMessageId);
  assert.equal(panelMessage, null, "panel checkout harus hilang setelah confirm");
});
