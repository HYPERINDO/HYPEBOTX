const test = require("node:test");
const assert = require("node:assert/strict");

const { createTemplateService } = require("../services/templateService");

function withEnv(patch, run) {
  const snapshot = {};
  for (const [key, value] of Object.entries(patch)) {
    snapshot[key] = process.env[key];
    if (value === null || value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("role template strict mode filters by allow list", () => {
  withEnv(
    {
      ROLE_TEMPLATE_STRICT: "true",
      ROLE_TEMPLATE_ALLOWED_NAMES: "HYPEBOTX,OWNER,ADMIN,SULTAN,LEGACY,ENHANCED,MEMBER,GAME BOOSTER,SERVER BOOSTER,MUTED,UNVERIFIED,PROMO PING,EVENT PING,HyperIndo Bot-web",
    },
    () => {
      const service = createTemplateService();
      const names = service.getRoleTemplates().map((entry) => entry.name);

      assert.deepEqual(names, [
        "HYPEBOTX",
        "OWNER",
        "ADMIN",
        "GAME BOOSTER",
        "SULTAN",
        "MUTED",
        "UNVERIFIED",
        "MEMBER",
        "ENHANCED",
        "LEGACY",
        "PROMO PING",
        "EVENT PING",
        "SERVER BOOSTER",
        "HyperIndo Bot-web",
      ]);
    },
  );
});

test("role template strict mode keeps backward compatibility when allow list is empty", () => {
  withEnv(
    {
      ROLE_TEMPLATE_STRICT: "true",
      ROLE_TEMPLATE_ALLOWED_NAMES: "",
    },
    () => {
      const service = createTemplateService();
      const names = service.getRoleTemplates().map((entry) => entry.name);
      assert.ok(names.includes("MANAGER"));
      assert.ok(names.includes("STAFF"));
      assert.ok(names.includes("VIP CUSTOMER"));
    },
  );
});
