const test = require("node:test");
const assert = require("node:assert/strict");

const roles = require("../../src/config/roles");
const { createVerifyService } = require("../../src/services/verifyService");

function createSilentLogger() {
  return { info() { }, warn() { }, error() { }, debug() { } };
}

function createMember({ userId, roleIds = [] } = {}) {
  const roleSet = new Set(roleIds);

  return {
    id: userId || "u-1",
    user: { id: userId || "u-1", tag: `${userId || "u-1"}#0001` },
    roles: {
      cache: {
        has: (rid) => roleSet.has(rid),
        // verifyService uses .has only; no need for full discord.js Collection
      },
    },
    _roleSet: roleSet,
  };
}

function createRoleService({ roleMap, member }) {
  return {
    getRoleMap: () => roleMap,
    addRole: async (_member, roleNameOrId) => {
      // verifyService passes roles.member / roles.unverified which are role NAMES strings
      // Our mock accepts those strings as role ids directly.
      member._roleSet.add(roleNameOrId);
    },
    removeRole: async (_member, roleNameOrId) => {
      member._roleSet.delete(roleNameOrId);
    },
  };
}

function createVerifyInteraction({ guild, member }) {
  const replied = [];

  return {
    guild,
    member,
    user: member.user,
    values: [],
    reply: async (payload) => {
      replied.push(payload);
      return payload;
    },
    _getLastReply() {
      const last = replied[replied.length - 1];
      if (!last) return null;
      if (typeof last === "string") return { content: last };
      return last;
    },
    _getAllReplies: () => replied,
  };
}

// --- shared role map for verifyService ---
function createRoleMapForVerify() {
  return {
    member: { id: roles.member },
    unverified: { id: roles.unverified },
    // roleService.getRoleMap is used only for .id
  };
}

test("verify-role: user klik verify -> dapat role member/verified; role unverified dicabut; klik verify dua kali tidak error", async () => {
  const guild = { id: "g-verify-1" };
  const member = createMember({ userId: "u-v1", roleIds: [roles.unverified, "OTHER"] });

  const roleService = createRoleService({ roleMap: createRoleMapForVerify(), member });
  const verifyService = createVerifyService({
    botConfig: { storeName: "HYPERINDO" },
    logger: createSilentLogger(),
    repositories: {},
    roleService,
    loggingService: { logBot: async () => { } },
  });

  const interaction = createVerifyInteraction({ guild, member });

  await verifyService.handleVerifyButton(interaction);
  assert.equal(member.roles.cache.has(roles.member), true, "MEMBER must be added after verify");
  assert.equal(member.roles.cache.has(roles.unverified), false, "UNVERIFIED must be removed after verify");

  // Second click should not throw and must respond
  const before = interaction._getAllReplies().length;
  await assert.doesNotReject(async () => verifyService.handleVerifyButton(interaction));
  assert.equal(interaction._getAllReplies().length, before + 1, "second verify should reply");
});

test("verify-role: role unverified dicabut; missing role MEMBER memberi error aman", async () => {
  const guild = { id: "g-verify-2" };
  const member = createMember({ userId: "u-v2", roleIds: [roles.unverified] });

  const roleService = createRoleService({ roleMap: createRoleMapForVerify(), member });
  const verifyService = createVerifyService({
    botConfig: { storeName: "HYPERINDO" },
    logger: createSilentLogger(),
    repositories: {},
    roleService,
    loggingService: { logBot: async () => { } },
  });

  const interaction = createVerifyInteraction({ guild, member });
  await verifyService.handleVerifyButton(interaction);

  assert.equal(member.roles.cache.has(roles.unverified), false, "UNVERIFIED must be removed after verify");
  assert.equal(member.roles.cache.has(roles.member), true, "MEMBER should be added after verify");

  // Now simulate missing MEMBER role in roleMap (roleMap.member is null)
  const roleServiceMissingMember = {
    getRoleMap: () => ({ member: null, unverified: { id: roles.unverified } }),
    addRole: async () => { },
    removeRole: async () => { },
  };

  const verifyServiceMissingMember = createVerifyService({
    botConfig: { storeName: "HYPERINDO" },
    logger: createSilentLogger(),
    repositories: {},
    roleService: roleServiceMissingMember,
    loggingService: { logBot: async () => { } },
  });

  const interactionMissing = createVerifyInteraction({ guild, member: createMember({ userId: "u-miss", roleIds: [roles.unverified] }) });
  await verifyServiceMissingMember.handleVerifyButton(interactionMissing);

  const last = interactionMissing._getLastReply();
  assert.ok(last?.content && /Role MEMBER belum ada/i.test(last.content), "missing MEMBER role should reply safe message");
});

test("verify-role: role panel add role; role panel remove role", async () => {
  const guild = { id: "g-verify-3" };

  // self role selection toggles roles.selfRoles (LEGACY, ENHANCED, etc)
  // verifyService.handleRoleSelect adds/removes roleName directly (string).
  const member = createMember({ userId: "u-self-1", roleIds: [roles.legacy] });

  const roleService = {
    getRoleMap: () => ({
      member: { id: roles.member },
      unverified: { id: roles.unverified },
    }),
    addRole: async (_member, roleNameOrId) => member._roleSet.add(roleNameOrId),
    removeRole: async (_member, roleNameOrId) => member._roleSet.delete(roleNameOrId),
  };

  const verifyService = createVerifyService({
    botConfig: { storeName: "HYPERINDO" },
    logger: createSilentLogger(),
    repositories: {},
    roleService,
    loggingService: { logBot: async () => { } },
  });

  const interaction = {
    guild,
    member,
    user: member.user,
    values: [roles.enhanced],
    reply: async () => { },
  };

  await verifyService.handleRoleSelect(interaction);

  assert.equal(member.roles.cache.has(roles.legacy), false, "legacy must be removed when not selected");
  assert.equal(member.roles.cache.has(roles.enhanced), true, "enhanced must be added when selected");
});

test("verify-role: invalid role ditolak", async () => {
  // If roleService throws on addRole, handleRoleSelect will throw (no try/catch in verifyService)
  const guild = { id: "g-verify-4" };
  const member = createMember({ userId: "u-invalid", roleIds: [] });

  const roleService = {
    getRoleMap: () => ({
      member: { id: roles.member },
      unverified: { id: roles.unverified },
    }),
    addRole: async (_member, roleNameOrId) => {
      throw new Error(`Invalid role: ${roleNameOrId}`);
    },
    removeRole: async () => { },
  };

  const verifyService = createVerifyService({
    botConfig: { storeName: "HYPERINDO" },
    logger: createSilentLogger(),
    repositories: {},
    roleService,
    loggingService: { logBot: async () => { } },
  });

  // handleRoleSelect only toggles roles.selfRoles; so we must pass a valid self-role value.
  const interaction = {
    guild,
    member,
    user: member.user,
    values: [roles.legacy],
    reply: async () => { },
  };

  await assert.rejects(() => verifyService.handleRoleSelect(interaction), /Invalid role/i);
});

test("verify-role: missing role member memberi error aman (safe verify) even when roleMap.member missing", async () => {
  const guild = { id: "g-verify-5" };
  const member = createMember({ userId: "u-safe", roleIds: [roles.unverified] });

  const roleService = {
    getRoleMap: () => ({ member: null, unverified: { id: roles.unverified } }),
    addRole: async () => { },
    removeRole: async () => { },
  };

  const verifyService = createVerifyService({
    botConfig: { storeName: "HYPERINDO" },
    logger: createSilentLogger(),
    repositories: {},
    roleService,
    loggingService: { logBot: async () => { } },
  });

  const interaction = createVerifyInteraction({ guild, member });
  await verifyService.handleVerifyButton(interaction);

  const last = interaction._getLastReply();
  assert.ok(last?.content && /Role MEMBER belum ada/i.test(last.content), "should reply safe error when member role missing");
});
