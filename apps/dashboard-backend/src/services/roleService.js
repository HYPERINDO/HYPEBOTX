import { PERMISSIONS, ROLE_VALUES, ROLES, hasPermission } from "@hypebotx/shared";
import { env } from "../config/env.js";

export function normalizeRole(value) {
  const role = String(value || "").toLowerCase();
  return ROLE_VALUES.includes(role) ? role : null;
}

export function isActiveStaff(user) {
  return !["suspended", "inactive", "disabled"].includes(String(user?.status || "active").toLowerCase());
}

export function resolveDashboardRole(discordId, staffUser = null) {
  const safeDiscordId = String(discordId || "");
  if (env.ownerDiscordIds.includes(safeDiscordId)) return ROLES.OWNER;
  if (!staffUser || !isActiveStaff(staffUser)) return null;
  return normalizeRole(staffUser.role || staffUser.dashboardRole || staffUser.staffRole);
}

export function roleCan(role, permission) {
  return hasPermission(role, permission);
}

export function allowedRolesFor(scope) {
  const scopes = {
    owner: [ROLES.OWNER],
    admin: [ROLES.OWNER, ROLES.ADMIN],
    joki: [ROLES.OWNER, ROLES.ADMIN, ROLES.PENJOKI],
    staff: [ROLES.OWNER, ROLES.ADMIN, ROLES.PENJOKI],
  };
  return scopes[scope] || scopes.staff;
}

export function redirectPathForRole(role) {
  if (role === ROLES.OWNER) return "/owner/dashboard";
  if (role === ROLES.ADMIN) return "/admin/dashboard";
  if (role === ROLES.PENJOKI) return "/penjoki/dashboard";
  return "/unauthorized";
}

export const permissionCatalog = PERMISSIONS;
