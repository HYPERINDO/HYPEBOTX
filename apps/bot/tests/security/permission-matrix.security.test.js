const test = require("node:test");
const assert = require("node:assert/strict");

const { hasNamedRole, hasAdminPermission, isOwnerOrStaff, isVerifiedMember, hasDjAccess, hasJokiCrewAccess } = require("../../src/utils/permissionCheck");
const roles = require("../../src/config/roles");

function createMember({ userId = "u1", roleNames = [], ownerId = "owner" } = {}) {
    const roleSet = new Set(roleNames);
    return {
        id: userId,
        guild: { ownerId },
        roles: {
            cache: {
                has: (r) => roleSet.has(r),
                values: () => Array.from(roleSet).map((r) => ({ name: r })),
                some: (fn) => Array.from(roleSet).some((r) => fn({ name: r })),
            },
        },
        permissions: {
            has: () => false,
        },
    };
}

test("permission matrix security: role-based guards", async () => {
    // Owner (by guild ownerId)
    const owner = createMember({ userId: "owner", roleNames: [] });
    assert.equal(hasAdminPermission(owner), true);
    assert.equal(isOwnerOrStaff(owner), true);
    assert.equal(isVerifiedMember(owner), true);
    assert.equal(hasDjAccess(owner), true);
    assert.equal(hasJokiCrewAccess(owner), true);

    // Admin
    const admin = createMember({ userId: "admin-1", roleNames: [roles.admin] });
    assert.equal(hasAdminPermission(admin), true);
    assert.equal(isOwnerOrStaff(admin), true);
    assert.equal(isVerifiedMember(admin), true);
    assert.equal(hasDjAccess(admin), true);
    assert.equal(hasJokiCrewAccess(admin), true);

    // Staff
    const staff = createMember({ userId: "staff-1", roleNames: [roles.staff] });
    assert.equal(hasAdminPermission(staff), false);
    assert.equal(isOwnerOrStaff(staff), true);
    assert.equal(isVerifiedMember(staff), true);
    assert.equal(hasDjAccess(staff), true);
    assert.equal(hasJokiCrewAccess(staff), true);

    // Manager (owner/staff-like)
    const manager = createMember({ userId: "mgr-1", roleNames: [roles.manager] });
    assert.equal(hasAdminPermission(manager), true, "manager should be treated as admin permission");
    assert.equal(isOwnerOrStaff(manager), true);
    assert.equal(hasJokiCrewAccess(manager), true);

    // IT Dev
    const itDev = createMember({ userId: "it-1", roleNames: [roles.itDev] });
    assert.equal(isOwnerOrStaff(itDev), true);
    assert.equal(hasJokiCrewAccess(itDev), true);

    // Penjoki (joki crew)
    const penjoki = createMember({ userId: "penjoki-1", roleNames: [roles.penjoki] });
    assert.equal(isOwnerOrStaff(penjoki), false);
    assert.equal(isVerifiedMember(penjoki), false);
    assert.equal(hasJokiCrewAccess(penjoki), true);
    assert.equal(hasDjAccess(penjoki), false);

    // Joki only
    const joki = createMember({ userId: "joki-1", roleNames: [roles.joki] });
    assert.equal(isOwnerOrStaff(joki), false);
    assert.equal(isVerifiedMember(joki), false);
    assert.equal(hasJokiCrewAccess(joki), true);

    // Verified member (member but not unverified)
    const verified = createMember({ userId: "cust-v1", roleNames: [roles.member] });
    assert.equal(isVerifiedMember(verified), true);
    assert.equal(isOwnerOrStaff(verified), false);
    assert.equal(hasJokiCrewAccess(verified), false);

    // Unverified member (member + unverified)
    const unverified = createMember({ userId: "cust-u1", roleNames: [roles.member, roles.unverified] });
    assert.equal(isVerifiedMember(unverified), false);

    // DJ role
    const dj = createMember({ userId: "dj-1", roleNames: [roles.dj] });
    assert.equal(hasDjAccess(dj), true);
    assert.equal(isOwnerOrStaff(dj), false);

    // Named-role alias should work for legacy roles
    const legacyCoOwner = createMember({ userId: "legacy-1", roleNames: [roles.coOwner, "CO OWNER"] });
    assert.equal(hasNamedRole(legacyCoOwner, roles.coOwner), true);

    // Negative cases
    const customer = createMember({ userId: "cust-1", roleNames: [] });
    assert.equal(hasAdminPermission(customer), false);
    assert.equal(isOwnerOrStaff(customer), false);
    assert.equal(isVerifiedMember(customer), false);
    assert.equal(hasJokiCrewAccess(customer), false);
});

test("security qa: permissionGuard.replyDenied emits logSecurity (best-effort) without spamming", async () => {
    const { requireVerifiedMember, requireAdmin } = require("../../src/middlewares/permissionGuard");

    let logCount = 0;
    const clientMock = {
        container: {
            services: {
                loggingService: {
                    logSecurity: async () => {
                        logCount += 1;
                    },
                },
            },
        },
        logger: { warn: () => { } },
    };

    const interactionBase = {
        client: clientMock,
        guild: { id: "g1" },
        guildId: "g1",
        user: { id: "u1", tag: "user#0001" },
        member: { id: "u1" },
        customId: "x",
        commandName: "cmd-test",
        replied: false,
        deferred: false,
        id: "i1",
        reply: async () => { },
        followUp: async () => { },
    };

    // make isVerifiedMember false
    const unverifiedMember = { id: "u1", guild: { ownerId: "owner" }, roles: { cache: { has: () => false, values: () => [], some: () => false } }, permissions: { has: () => false } };
    const interaction = { ...interactionBase, member: unverifiedMember };

    // call both guards -> both should hit replyDenied => logSecurity called at least once
    await requireVerifiedMember(interaction);
    await requireAdmin(interaction);

    assert.ok(logCount >= 1, "expected logSecurity to be called for denied interactions");
});
