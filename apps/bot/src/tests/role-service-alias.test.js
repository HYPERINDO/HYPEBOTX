const test = require("node:test");
const assert = require("node:assert/strict");

const { createRoleService } = require("../services/roleService");

function createRole(id, name) {
  return {
    id,
    name,
  };
}

function createGuild(roles) {
  const list = Array.isArray(roles) ? roles : [];
  return {
    id: "guild-role-alias",
    roles: {
      cache: {
        find(predicate) {
          return list.find(predicate) || null;
        },
      },
    },
  };
}

function createService() {
  return createRoleService({
    logger: { info() { }, warn() { }, error() { } },
    repositories: {
      guildRepository: {
        async upsert() { },
      },
    },
    templateService: {
      getRoleTemplates() {
        return [];
      },
    },
  });
}

test("role service maps legacy role aliases to live role keys", () => {
  const guild = createGuild([
    createRole("r-owner", "OWNER"),
    createRole("r-admin", "ADMIN"),
    createRole("r-member", "MEMBER"),
    createRole("r-unverified", "UNVERIFIED"),
    createRole("r-vip", "VIP CUSTOMER"),
    createRole("r-boosting", "BOOSTING PING"),
    createRole("r-joki", "JOKI PING"),
    createRole("r-web", "HyperIndo Bot-web"),
  ]);

  const service = createService();
  const roleMap = service.getRoleMap(guild);

  assert.equal(roleMap.vipCustomer?.id, "r-vip");
  assert.equal(roleMap.sultanHyperindo?.id, "r-vip");
  assert.equal(roleMap.serverBooster?.id, "r-boosting");
  assert.equal(roleMap.jokiPing?.id, "r-joki");
  assert.equal(roleMap.botWeb?.id, "r-web");
});
