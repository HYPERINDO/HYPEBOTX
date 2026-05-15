const assert = require("node:assert/strict");
const test = require("node:test");
const { createPaymentService } = require("../services/paymentService");

function createService(settings = {}) {
  return createPaymentService({
    botConfig: {
      storeName: "GameStore",
      payment: {
        bank: "BCA - 5358047992 a.n. ALVIAN DIKY PUTRA UTOMO | BRI - 040801040543505 a.n. ALVIAN DIKY PUTRA UTOMO",
        ewallet: "DANA - 089531277179 a/n ALVIAN DIKY PUTRA UTOMO | SHOPEEPAY - 089531277179 a/n ALVIAN DIKY PUTRA UTOMO",
        qris: "-",
      },
    },
    logger: { info() {} },
    repositories: {
      simpleStoreRepository: {
        async getSettings() {
          return settings;
        },
      },
    },
    loggingService: {},
    getJokiService: () => null,
  });
}

test("payment panel ignores broken short bank setting and has no proof button", async () => {
  const service = createService({ payment_bank: "60" });
  let payload;
  const channel = {
    async send(message) {
      payload = message;
      return message;
    },
  };

  await service.sendPaymentPanel(channel);

  const data = payload.embeds[0].toJSON();
  assert.equal(data.title, "Payment Method - HYPERINDO");
  assert.match(data.description, /BCA - 5358047992/);
  assert.match(data.description, /BRI - 040801040543505/);
  assert.doesNotMatch(data.description, /\*\*Bank Transfer\*\*\n60\n/);
  assert.equal(data.image.url, "attachment://payment-method-banner.png");
  assert.equal(payload.files.length, 1);
  assert.deepEqual(payload.components, []);
});
