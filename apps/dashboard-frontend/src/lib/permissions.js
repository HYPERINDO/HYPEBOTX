export function canUseRoute(role, allowedRoles) {
  if (!allowedRoles?.length) return true;
  return allowedRoles.includes(role);
}
