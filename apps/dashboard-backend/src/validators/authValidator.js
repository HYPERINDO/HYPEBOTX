export function hasOAuthCallback(query) {
  return Boolean(query?.code && query?.state);
}
