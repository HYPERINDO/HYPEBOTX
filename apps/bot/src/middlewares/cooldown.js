function useCooldown(client, key, seconds) {
  const now = Date.now();
  const expires = now + seconds * 1000;
  const current = client.cooldowns.get(key);

  if (current && current > now) {
    return Math.ceil((current - now) / 1000);
  }

  client.cooldowns.set(key, expires);
  return 0;
}

module.exports = {
  useCooldown,
};
