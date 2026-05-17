import { fail } from "../utils/response.js";

export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return fail(res, 401, "Login required.");
  }
  return next();
}
