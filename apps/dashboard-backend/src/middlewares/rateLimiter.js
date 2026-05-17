import { fail } from "../utils/response.js";

const buckets = new Map();

export function rateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  return function rateLimit(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > max) return fail(res, 429, "Terlalu banyak request. Coba lagi sebentar.");
    return next();
  };
}
