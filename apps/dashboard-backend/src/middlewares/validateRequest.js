import { fail } from "../utils/response.js";

export function requireFields(fields) {
  return function validate(req, res, next) {
    const missing = fields.filter((field) => !req.body?.[field]);
    if (missing.length) return fail(res, 400, "Request tidak valid.", { missing });
    return next();
  };
}
