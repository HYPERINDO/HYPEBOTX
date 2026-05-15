const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hasDjAccess,
  isOwnerOrStaff,
  isVerifiedMember,
} = require("../utils/permissionCheck");
const { requireMusicController } = require("../middlewares/permissionGuard");

function createRoleCache(roleNames = []) {
  return {
    some(callback) {
      return roleNames.some((roleName) => callback({ name: roleName }));
    },
  };
}

function createMember({ roleNames = [], voiceChannelId = null } = {}) {
  return {
    permissions: {
      has() {
        return false;
      },
    },
    roles: {
      cache: createRoleCache(roleNames),
    },
    voice: {
      channelId: voiceChannelId,
    },
  };
}

function createInteraction(member) {
  const replies = [];

  return {
    replies,
    guild: { id: "guild-1" },
    member,
    replied: false,
    deferred: false,
    async reply(payload) {
      replies.push(payload);
      this.replied = true;
    },
    async followUp(payload) {
      replies.push(payload);
    },
  };
}

test("verified member helper follows role rules", () => {
  assert.equal(isVerifiedMember(createMember({ roleNames: ["MEMBER"] })), true);
  assert.equal(isVerifiedMember(createMember({ roleNames: ["MEMBER", "UNVERIFIED"] })), false);
  assert.equal(isVerifiedMember(createMember({ roleNames: ["STAFF"] })), true);
  assert.equal(isOwnerOrStaff(createMember({ roleNames: ["OWNER"] })), true);
  assert.equal(hasDjAccess(createMember({ roleNames: ["DJ"] })), true);
});

test("music controller guard blocks non-DJ users", async () => {
  const interaction = createInteraction(createMember({ roleNames: ["MEMBER"], voiceChannelId: "vc-1" }));
  const result = await requireMusicController(interaction, {
    getQueue() {
      return { voiceChannelId: "vc-1" };
    },
  });

  assert.equal(result.ok, false);
  assert.match(interaction.replies[0].content, /role `DJ`/);
});

test("music controller guard allows DJ in the same voice channel", async () => {
  const interaction = createInteraction(createMember({ roleNames: ["DJ"], voiceChannelId: "vc-1" }));
  const result = await requireMusicController(interaction, {
    getQueue() {
      return { voiceChannelId: "vc-1" };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(interaction.replies.length, 0);
});
