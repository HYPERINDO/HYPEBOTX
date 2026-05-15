const { PermissionFlagsBits } = require("discord.js");
const roleNames = require("../config/roles");

const legacyRoleAliases = {
  [roleNames.coOwner]: ["CO OWNER"],
  [roleNames.itDev]: ["IT DEV"],
  [roleNames.penjoki]: ["PENJOKI"],
  [roleNames.jokiPing]: ["JOKI PING", "BOOSTING PING"],
  [roleNames.serverBooster]: ["BOOSTING PING"],
  [roleNames.vipCustomer]: ["VIP CUSTOMER", "SULTAN HYPERINDO"],
};

function normalizeRoleName(roleName) {
  return String(roleName || "").trim().toUpperCase();
}

function hasNamedRole(member, roleName) {
  const names = new Set(
    [roleName, ...(legacyRoleAliases[roleName] || [])].map(normalizeRoleName),
  );

  const cache = member?.roles?.cache;
  if (!cache) return false;

  // Some tests or mocks may key roles by name instead of role id.
  if (typeof cache.has === "function") {
    for (const name of names) {
      try {
        if (cache.has(name)) return true;
      } catch {
        // ignore
      }
    }
  }

  // Discord.js Collection: Map-like with values()
  if (typeof cache.values === "function") {
    return Boolean(
      Array.from(cache.values()).some((role) => names.has(normalizeRoleName(role?.name))),
    );
  }

  // cache.some() (used by some test mocks)
  if (typeof cache.some === "function") {
    return Boolean(cache.some((role) => names.has(normalizeRoleName(role?.name))));
  }

  // Array-like
  if (Array.isArray(cache)) {
    return Boolean(cache.some((role) => names.has(normalizeRoleName(role?.name))));
  }

  // Plain object
  if (typeof cache === "object") {
    const roles = Object.values(cache);
    return Boolean(roles.some((role) => names.has(normalizeRoleName(role?.name))));
  }

  return false;
}

function hasAdminPermission(member) {
  if (!member) {
    return false;
  }

  // Owner by guild ownerId (some tests mock this without roles)
  try {
    if (member.guild?.ownerId && member.id && member.guild.ownerId === member.id) {
      return true;
    }
  } catch {
    // ignore
  }

  return Boolean(
    member.permissions?.has(PermissionFlagsBits.Administrator) ||
    member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    [roleNames.owner, roleNames.manager, roleNames.admin].some((roleName) => hasNamedRole(member, roleName)),
  );
}

function isOwnerOrStaff(member) {
  if (!member) {
    return false;
  }

  return (
    hasAdminPermission(member) ||
    [roleNames.owner, roleNames.manager, roleNames.admin, roleNames.staff, roleNames.itDev].some((roleName) =>
      hasNamedRole(member, roleName),
    )
  );
}

function isVerifiedMember(member) {
  if (!member) {
    return false;
  }

  if (hasNamedRole(member, roleNames.unverified)) {
    return false;
  }

  if (isOwnerOrStaff(member)) {
    return true;
  }

  return hasNamedRole(member, roleNames.member);
}

function hasDjAccess(member) {
  return isOwnerOrStaff(member) || hasNamedRole(member, roleNames.dj);
}

function hasJokiCrewAccess(member) {
  return (
    isOwnerOrStaff(member) ||
    // support both "joki crew" aliases & role names used across tests
    hasNamedRole(member, roleNames.joki) ||
    hasNamedRole(member, roleNames.penjoki) ||
    hasNamedRole(member, roleNames.pramugara) ||
    hasNamedRole(member, roleNames.owner)
  );
}

module.exports = {
  hasNamedRole,
  hasAdminPermission,
  isOwnerOrStaff,
  isVerifiedMember,
  hasDjAccess,
  hasJokiCrewAccess,
};
