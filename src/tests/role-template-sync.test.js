const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionFlagsBits } = require("discord.js");

const roleTemplate = require("../templates/roleTemplate");
const roles = require("../config/roles");

function getRole(name) {
  return roleTemplate.find((entry) => entry.name === name) || null;
}

test("role template contains required roles for verify, staff, and joki flows", () => {
  const required = [
    roles.owner,
    roles.admin,
    roles.staff,
    roles.member,
    roles.unverified,
    roles.itDev,
    roles.penjoki,
    roles.pramugara,
    roles.dj,
    ...roles.selfRoles,
  ];

  for (const roleName of required) {
    assert.ok(getRole(roleName), `missing role template entry: ${roleName}`);
  }
});

test("admin/staff permission model is consistent", () => {
  const admin = getRole(roles.admin);
  const staff = getRole(roles.staff);

  assert.ok(admin, "ADMIN role template missing");
  assert.ok(staff, "STAFF role template missing");

  assert.equal(admin.permissions.includes(PermissionFlagsBits.ManageGuild), true, "ADMIN should have ManageGuild");
  assert.equal(admin.permissions.includes(PermissionFlagsBits.ManageChannels), true, "ADMIN should have ManageChannels");
  assert.equal(staff.permissions.includes(PermissionFlagsBits.ManageChannels), true, "STAFF should have ManageChannels");
  assert.equal(staff.permissions.includes(PermissionFlagsBits.ManageGuild), false, "STAFF should not have ManageGuild");
});

