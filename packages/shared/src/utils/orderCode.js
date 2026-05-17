export function generateOrderCode(prefix = "HYPE", now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${stamp}-${random}`;
}
