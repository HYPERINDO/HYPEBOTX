import { env } from "../config/env.js";
import { fail } from "../utils/response.js";

export function errorHandler(error, _req, res, _next) {
  const message = env.nodeEnv === "production" ? "Internal server error." : error?.message || "Internal server error.";
  return fail(res, error?.status || 500, message);
}
