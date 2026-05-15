const test = require("node:test");
const assert = require("node:assert/strict");
const { hasAdminPermission, isOwnerOrStaff, hasJokiCrewAccess } = require("../../src/utils/permissionCheck");
const roles = require("../../src/config/roles");

test("permission matrix heavy: multiple scenarios", async () => {
    // Member mock builder
    const m = (roleList, id = "u") => ({
        id,
        roles: { cache: { has: (r) => roleList.includes(r) } },
        guild: { ownerId: "owner" }
    });

    // Owner
    assert.equal(hasAdminPermission(m([], "owner")), true);
    assert.equal(isOwnerOrStaff(m([], "owner")), true);
    assert.equal(hasJokiCrewAccess(m([], "owner")), true);

    // Admin
    const admin = m([roles.admin]);
    assert.equal(hasAdminPermission(admin), true);
    assert.equal(isOwnerOrStaff(admin), true);
    assert.equal(hasJokiCrewAccess(admin), true); // Admins have joki access

    // Staff
    const staff = m([roles.staff]);
    assert.equal(hasAdminPermission(staff), false);
    assert.equal(isOwnerOrStaff(staff), true);
    assert.equal(hasJokiCrewAccess(staff), true); // Staff have joki access

    // Joki
    const joki = m([roles.joki]);
    assert.equal(hasAdminPermission(joki), false);
    assert.equal(isOwnerOrStaff(joki), false);
    assert.equal(hasJokiCrewAccess(joki), true);

    // Customer / Member
    const customer = m([roles.member]);
    assert.equal(hasAdminPermission(customer), false);
    assert.equal(isOwnerOrStaff(customer), false);
    assert.equal(hasJokiCrewAccess(customer), false);
    
    // Multiple roles
    const hybrid = m([roles.joki, roles.member]);
    assert.equal(hasJokiCrewAccess(hybrid), true);
    assert.equal(isOwnerOrStaff(hybrid), false);
});
